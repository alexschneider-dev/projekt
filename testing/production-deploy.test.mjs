import yaml from "js-yaml";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";


const root = resolve(import.meta.dirname, "..");

for (const finalState of ["completed", "rollback_completed", "paused", "updating"]) {
  test(`Stack wartet auf Edge und bewertet ${finalState} korrekt`, t => {
    const dir = fixture(t);

    writeFileSync(join(dir, "runtime.json"), "{}");

    for (const command of ["flock", "sleep"]) {
      writeFileSync(join(dir, `bin/${command}`), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    }

    writeFileSync(join(dir, "bin/docker"), `#!/bin/sh
case "$1 $2" in
  "service inspect")
    case "$*" in
      *UpdateStatus*)
        if [ "$3" != "projekt-edge_edge" ]; then echo completed;
        elif [ -f "$STATUS_DIR/$3" ]; then echo "$FINAL_STATE";
        else touch "$STATUS_DIR/$3"; echo updating; fi ;;
      *) echo example/image:1.0 ;;
    esac ;;
esac
`, { mode: 0o755 });
    writeFileSync(join(dir, "deploy-stack.sh"), readFileSync(join(root, "production/deploy-stack.sh"), "utf8")
      .replace("/var/lock/projekt-deploy.lock", join(dir, "lock"))
      .replace("/etc/projekt/runtime.json", join(dir, "runtime.json"))
      .replace("attempt<150", "attempt<3"));

    const result = run("bash", [join(dir, "deploy-stack.sh")], {
      PATH: `${dir}/bin:${process.env.PATH}`, STATUS_DIR: dir, FINAL_STATE: finalState,
    });

    assert.equal(result.status, finalState === "completed" ? 0 : 1, result.stderr);

    if (finalState === "updating") assert.match(result.stderr, /Zeitlimit überschritten/);
  });
}

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "production-test-"));

  t.after(() => rmSync(dir, { recursive: true, force: true }));

  mkdirSync(join(dir, "bin"));
  writeFileSync(
    join(dir, "runtime-overlay.mjs"),
    readFileSync(join(root, "production/runtime-overlay.mjs"))
  );

  for (const file of [
    "compose.edge.yml",
    "edge-haproxy.cfg"
  ]) {
    writeFileSync(join(dir, file), readFileSync(join(root, "production", file)));
  }

  return dir;
}

function run(cmd, args, env = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", env: { ...process.env, ...env } });
}

test("Umstellung hält Zugangsdaten aus dem Manifest heraus; erzeugter Stack enthält keine Env-Dateien", t => {
  const dir = fixture(t);

  for (const name of ["nextjs", "postgres"]) {
    writeFileSync(join(dir, `${name}.env`), {
      nextjs: 'DATABASE_URL="postgres://test:$literal@postgres/db"\nNEXTAUTH_SECRET="a $secret"\nNEXTAUTH_URL="https://example.test/$literal"\n',
      postgres: 'POSTGRES_PASSWORD="private-password"\n',
    }[name] || "");
  }

  const dockerLog = join(dir, "docker.log");

  writeFileSync(
    join(dir, "bin/docker"),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$DOCKER_LOG"\ncat >/dev/null\n',
    { mode: 0o755 }
  );

  const output = join(dir, "runtime.json");
  const args = [join(root, "production/prepare-config.mjs"), dir, output, "test", "--apply"];
  const preview = run(process.execPath, args.slice(0, -1));

  assert.equal(preview.status, 0, preview.stderr);
  assert.ok(!preview.stdout.includes("private-password"));

  const result = run(process.execPath, args, { PATH: `${dir}/bin:${process.env.PATH}`, DOCKER_LOG: dockerLog });

  assert.equal(result.status, 0, result.stderr);

  const text = readFileSync(output, "utf8");

  for (const value of ["postgres://", "private-value", "private-password", "private-elastic", "a $secret"]) {
    assert.ok(!text.includes(value), value);
  }

  const spec = JSON.parse(text);

  assert.equal(spec.services.nextjs.environment.NEXTAUTH_URL, "https://example.test/$$literal");
  assert.ok(spec.services.nextjs.secrets.some(s => s.target === "runtime_DATABASE_URL"));
  assert.equal(spec.services.postgres.command, undefined);
  assert.equal(spec.services.nextjs.entrypoint, undefined);

  const imageEnv = Object.fromEntries(["NEXTJS", "NGINX", "POSTGRES", "REDIS"]
    .map(name => [`${name}_IMAGE`, "example/test:1.0"]));
  const rendered = run(
    "docker",
    ["stack", "config", "-c", join(root, "production/compose.swarm.yml"), "-c", output],
    imageEnv
  );

  assert.equal(rendered.status, 0, rendered.stderr);
  assert.ok(!rendered.stdout.includes("env_file"));

  const retry = run(process.execPath, args, { PATH: `${dir}/bin:${process.env.PATH}`, DOCKER_LOG: dockerLog });

  assert.notEqual(retry.status, 0, "Ein bestehendes Manifest darf nicht überschrieben werden");
});

for (const state of ["Complete 1 second ago", "Failed 1 second ago", "missing-secret"]) {
  test(`Prisma-Migration verwendet nur eingebundene Zugangsdaten; Status=${state}`, t => {
    const dir = fixture(t);
    const log = join(dir, "calls");

    writeFileSync(join(dir, "bin/flock"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    writeFileSync(join(dir, "bin/docker"), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify(args) + "\\n");
if (args[1] === 'inspect' && process.env.TEST_STATE !== 'missing-secret') {
  console.log(args.join(' ').includes('ContainerSpec.Secrets') ? 'db_url_v1' : 'entrypoint_v1');
}
if (args[1] === 'ps') console.log(process.env.TEST_STATE);
`, { mode: 0o755 });
    writeFileSync(join(dir, "migrate.sh"), readFileSync(join(root, "production/migrate.sh"), "utf8")
      .replace("/var/lock/projekt-deploy.lock", join(dir, "lock")));

    const result = run("bash", [join(dir, "migrate.sh"), "2.0"], {
      PATH: `${dir}/bin:${process.env.PATH}`, CALL_LOG: log, TEST_STATE: state,
    });

    assert.equal(result.status, state.startsWith("Complete") ? 0 : 1, result.stderr);

    const calls = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);

    assert.ok(!calls.some(args => args[0] === "exec" || args.includes("--env")));

    const create = calls.find(args => args[1] === "create");

    if (state === "missing-secret") {
      assert.equal(create, undefined);
      assert.ok(!calls.some(args => args[0] === "pull"));
    } else {
      assert.ok(create.includes("source=db_url_v1,target=runtime_DATABASE_URL"));
      assert.ok(create.includes("source=entrypoint_v1,target=/production-entrypoint.sh"));
      assert.ok(create.includes("ghcr.io/alexschneider-dev/projekt-migration:2.0"));
      assert.ok(create.includes("projekt_net"));
      assert.deepEqual(calls.at(-1), ["service", "rm", "projekt_migration"]);
    }
  });
}

test("Startscript erhält Shell-Syntax als Text und abschließende Zeilenumbrüche", t => {
  const dir = fixture(t);
  const secrets = join(dir, "secrets");

  mkdirSync(secrets);

  const value = 'literal $(touch /tmp/should-not-exist) `id` $HOME\n\n';

  writeFileSync(join(secrets, "runtime_TEST_CREDENTIAL"), value);

  const script = readFileSync(join(root, "production/secrets-entrypoint.sh"), "utf8")
    .replace("/run/secrets/runtime_*", `${secrets}/runtime_*`);

  writeFileSync(join(dir, "entrypoint.sh"), script);

  const result = run("sh", [join(dir, "entrypoint.sh"), process.execPath,
    "-e", "process.stdout.write(process.env.TEST_CREDENTIAL)"]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, value);
});

for (const service of ["nextjs", "nginx"]) {
  for (const rollback of [false, true]) {
    test(`Nur ${service} erhält Image und Konfiguration; Rollback=${rollback}`, t => {
      const dir = fixture(t);
      const log = join(dir, "calls");
      const captured = join(dir, "applied.yml");
      const repository = service === "nextjs" ? "projekt" : "nginx-projekt";
      const dockerPath = run("sh", ["-c", "command -v docker"]).stdout.trim();
      const base = yaml.load(readFileSync(join(root, "production/compose.swarm.yml"), "utf8"));

      base.services[service].deploy.replicas = 4;
      base.services[service].deploy.resources.limits.memory = "384M";

      writeFileSync(join(dir, "compose.swarm.yml"), yaml.dump(base));

      const runtime = {
        version: "3.9",
        services: Object.fromEntries(Object.keys(base.services).map(name => [name, {
          environment: { TEST_LITERAL: "keep-$$literal" },
          deploy: {
            replicas: 9,
            update_config: { order: "stop-first" },
            resources: { limits: { memory: "8G" } },
          },
          image: "example/wrong:9.0",
          command: ["false"],
          entrypoint: ["false"],
          networks: ["unexpected"],
          secrets: ["nginx", "redis"].includes(name)
            ? [] : [{ source: "test_token", target: "runtime_NEW_API_TOKEN" }],
          configs: [{ source: "entrypoint", target: "/production-entrypoint.sh" }],
        }])),
        secrets: { test_token: { external: true, name: "token_v2" } },
        configs: { entrypoint: { external: true, name: "entrypoint_v1" } },
      };

      writeFileSync(join(dir, "runtime.json"), JSON.stringify(runtime));
      writeFileSync(join(dir, "bin/docker"), `#!/usr/bin/env node
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify(args) + "\\n");
if (args[0] === 'stack' && args[1] === 'config') {
  const r = spawnSync(process.env.REAL_DOCKER, args, {encoding:'utf8'});
  process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
  process.exit(r.status ?? 1);
}
if (args[0] === 'stack' && args[1] === 'deploy') {
  const files = [];
  args.forEach((arg,i) => { if (arg === '-c') files.push('-c', args[i+1]); });
  const r = spawnSync(process.env.REAL_DOCKER, ['stack','config', ...files], {encoding:'utf8'});
  fs.writeFileSync(process.env.CAPTURED, r.stdout || '');
  process.stderr.write(r.stderr || ''); process.exit(r.status ?? 1);
}
if (args[0] === 'service' && args[1] === 'inspect') {
  if (args.some(arg => arg.includes('UpdateStatus'))) {
    const marker = process.env.CALL_LOG + '.status';
    const seen = fs.existsSync(marker);
    fs.writeFileSync(marker, '1');
    console.log(seen ? process.env.TEST_STATE : 'updating');
  }
  else console.log(process.env.TEST_IMAGE);
}
`, { mode: 0o755 });
      writeFileSync(join(dir, "bin/sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
      writeFileSync(join(dir, "bin/flock"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
      writeFileSync(join(dir, "deploy.sh"), readFileSync(join(root, "production/deploy.sh"), "utf8")
        .replace("/var/lock/projekt-deploy.lock", join(dir, "lock"))
        .replace("/etc/projekt/runtime.json", join(dir, "runtime.json")));
      // Der angeforderte Tag läuft bereits; reine Konfigurationsänderungen müssen dennoch greifen.
      const result = run("bash", [join(dir, "deploy.sh"), service, "2.0"], {
        PATH: `${dir}/bin:${process.env.PATH}`, CALL_LOG: log, CAPTURED: captured,
        REAL_DOCKER: dockerPath, TEST_STATE: rollback ? "rollback_completed" : "completed",
        TEST_IMAGE: `ghcr.io/alexschneider-dev/${repository}:2.0@sha256:test`,
      });

      assert.equal(result.status, rollback ? 1 : 0, result.stderr);

      const applied = yaml.load(readFileSync(captured, "utf8"));

      assert.deepEqual(Object.keys(applied.services), [service]);

      const spec = applied.services[service];

      assert.equal(spec.image, `ghcr.io/alexschneider-dev/${repository}:2.0`);
      assert.equal(spec.deploy.replicas, 4);
      assert.equal(spec.deploy.update_config.order, "start-first");
      assert.deepEqual(spec.command, base.services[service].command);
      assert.deepEqual(spec.entrypoint, base.services[service].entrypoint);
      assert.ok(!Object.hasOwn(spec.networks, "unexpected"));
      assert.equal(Number(spec.deploy.resources.limits.memory), 384 * 1024 * 1024);

      if (service === "nginx") {
        assert.equal(spec.secrets?.length || 0, 0);
      } else {
        assert.ok(spec.secrets.some(secret => secret.target === "runtime_NEW_API_TOKEN"));
      }

      assert.ok(spec.configs.some(config => config.target === "/production-entrypoint.sh"));
      assert.equal(spec.environment.TEST_LITERAL, "keep-$literal");
      assert.deepEqual(spec.healthcheck, base.services[service].healthcheck);

      const calls = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
      const deploys = calls.filter(args => args[0] === "stack" && args[1] === "deploy");

      assert.equal(deploys.length, 1);
      assert.ok(!deploys[0].includes("--prune"));
      assert.ok(calls.filter(args => args[0] === "service").every(args => args.includes(`projekt_${service}`)));
    });
  }
}

test("Stack-Bereitstellung erhält alle laufenden Image-Referenzen ohne erneute Tag-Auflösung", t => {
  const dir = fixture(t);

  writeFileSync(join(dir, "runtime.json"), "{}");
  writeFileSync(join(dir, "bin/flock"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(join(dir, "bin/docker"), `#!/bin/sh
case "$1 $2" in
  "service inspect")
    case "$*" in
      *UpdateStatus*) echo completed ;;
      *) echo "example/$3:2.0@sha256:live" ;;
    esac ;;
  "stack deploy")
    printf '%s\\n' "$*" >> "$CALL_LOG"
    env | sort >> "$CALL_LOG" ;;
esac
`, { mode: 0o755 });
  writeFileSync(join(dir, "deploy-stack.sh"), readFileSync(join(root, "production/deploy-stack.sh"), "utf8")
    .replace("/var/lock/projekt-deploy.lock", join(dir, "lock"))
    .replace("/etc/projekt/runtime.json", join(dir, "runtime.json")));

  const log = join(dir, "calls");
  const result = run("bash", [join(dir, "deploy-stack.sh")], {
    PATH: `${dir}/bin:${process.env.PATH}`, CALL_LOG: log,
  });

  assert.equal(result.status, 0, result.stderr);

  const calls = readFileSync(log, "utf8");

  assert.match(calls, /--resolve-image never/);
  assert.match(calls, /-c compose.edge.yml projekt-edge/);
  assert.match(calls, /-c compose.swarm.yml .* projekt/);
  assert.match(calls, /EDGE_IMAGE=example\/projekt-edge_edge:2.0@sha256:live/);
  assert.match(calls, /EDGE_CONFIG_NAME=projekt_edge_haproxy_[a-f0-9]{64}/);

  for (const service of ["nextjs", "nginx", "postgres", "redis"]) {
    assert.ok(calls.includes(`${service.toUpperCase()}_IMAGE=example/projekt_${service}:2.0@sha256:live`));
  }
});

test("Stack verwendet Compose trotz widersprüchlicher Laufzeit-Betriebsparameter", t => {
  const dir = fixture(t);
  const captured = join(dir, "applied.yml");
  const runtimePath = join(dir, "runtime.json");
  const dockerPath = run("sh", [
    "-c",
    "command -v docker"
  ]).stdout.trim();
  const runtime = {
    services: {
      nextjs: {
        deploy: {
          replicas: 9,
          update_config: { order: "stop-first" },
          rollback_config: { order: "stop-first" },
          resources: {
            reservations: { memory: "128M" },
            limits: { memory: "8G" }
          }
        },
        image: "example/wrong:9.0",
        command: ["false"],
        environment: { NEXTAUTH_URL: "https://example.test" },
        secrets: [{
          source: "auth",
          target: "runtime_NEXTAUTH_SECRET"
        }],
        configs: [{
          source: "entrypoint",
          target: "/production-entrypoint.sh"
        }]
      },
      unexpected: { image: "example/unexpected:1.0" }
    },
    secrets: { auth: {
      external: true,
      name: "existing_auth"
    } },
    configs: { entrypoint: {
      external: true,
      name: "existing_entrypoint"
    } }
  };

  writeFileSync(runtimePath, JSON.stringify(runtime));
  writeFileSync(join(dir, "compose.swarm.yml"), readFileSync(join(root, "production/compose.swarm.yml")));
  writeFileSync(join(dir, "bin/flock"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(join(dir, "bin/docker"), `#!/usr/bin/env node
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const args = process.argv.slice(2);
if (args[0] === "service" && args[1] === "inspect") {
  console.log(args.join(" ").includes("UpdateStatus") ? "completed" : "example/image:1.0");
} else if (args[0] === "stack") {
  const files = [];
  args.forEach((arg, i) => { if (arg === "-c") files.push("-c", args[i + 1]); });
  const result = spawnSync(process.env.REAL_DOCKER, ["stack", "config", ...files], { encoding: "utf8" });
  if (args[1] === "deploy") fs.writeFileSync(process.env.CAPTURED, result.stdout || "");
  process.stderr.write(result.stderr || "");
  process.exit(result.status ?? 1);
}
`, { mode: 0o755 });
  writeFileSync(join(dir, "deploy-stack.sh"), readFileSync(join(root, "production/deploy-stack.sh"), "utf8")
    .replace("/var/lock/projekt-deploy.lock", join(dir, "lock"))
    .replace("/etc/projekt/runtime.json", runtimePath));

  const result = run("bash", [join(dir, "deploy-stack.sh")], {
    PATH: `${dir}/bin:${process.env.PATH}`,
    REAL_DOCKER: dockerPath,
    CAPTURED: captured
  });

  assert.equal(result.status, 0, result.stderr);

  const applied = yaml.load(readFileSync(captured, "utf8"));
  const app = applied.services.nextjs;

  assert.equal(app.deploy.replicas, 1);
  assert.equal(app.deploy.update_config.order, "start-first");
  assert.equal(app.deploy.rollback_config.order, "start-first");
  assert.equal(Number(app.deploy.resources.reservations.memory), 256 * 1024 * 1024);
  assert.equal(Number(app.deploy.resources.limits.memory), 1024 * 1024 * 1024);
  assert.equal(app.image, "example/image:1.0");
  assert.deepEqual(app.command, [
    "node",
    "server.js"
  ]);
  assert.equal(app.environment.NEXTAUTH_URL, "https://example.test");
  assert.equal(app.secrets[0].target, "runtime_NEXTAUTH_SECRET");
  assert.equal(app.configs[0].target, "/production-entrypoint.sh");
  assert.equal(applied.secrets.auth.name, "existing_auth");
  assert.equal(applied.services.unexpected, undefined);
  assert.deepEqual(JSON.parse(readFileSync(runtimePath, "utf8")), runtime);
});
