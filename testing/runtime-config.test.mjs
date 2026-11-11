import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  resolveRuntime,
  runtimeKeys,
  secretName
} from "../production/runtime-config.mjs";
import { ERROR_CONFIG } from "../production/errors/config.mjs";


function fixture() {
  return {
    services: {
      nextjs: {
        environment: { PORT: "3000" },
        secrets: [{
          source: "legacy",
          target: "runtime_DATABASE_URL"
        }],
        configs: [{
          source: "entrypoint",
          target: "/production-entrypoint.sh"
        }]
      }
    },
    secrets: {
      legacy: {
        external: true,
        name: "database_r7"
      },
      nextjs_NEXTAUTH_SECRET: {
        external: true,
        name: "auth_r3"
      },
      file_secret: {
        external: true,
        name: "existing_file_secret"
      }
    },
    configs: {
      entrypoint: {
        external: true,
        name: "entrypoint_r1"
      }
    }
  };
}

test("Zentrale Deklaration ergänzt Einbindungen und erhält Rotation sowie Datei-Secrets", () => {
  const input = fixture();
  const original = structuredClone(input);
  const inspected = [];
  const result = resolveRuntime(input, ["nextjs"], runtimeKeys, name => inspected.push(name));

  assert.deepEqual(input, original);
  assert.deepEqual(inspected, [
    "database_r7",
    "auth_r3",
    "projekt_nextjs_redis_url_v1"
  ]);
  assert.equal(result.secrets.nextjs_DATABASE_URL.name, "database_r7");
  assert.equal(result.secrets.nextjs_NEXTAUTH_SECRET.name, "auth_r3");
  assert.deepEqual(result.secrets.file_secret, input.secrets.file_secret);
  assert.deepEqual(result.services.nextjs.secrets.map(secret => secret.target), [
    "runtime_DATABASE_URL",
    "runtime_NEXTAUTH_SECRET",
    "runtime_REDIS_URL"
  ]);
});

test("Neue Secrets erhalten ihren zentral abgeleiteten Namen ohne Server-Zuordnung", () => {
  const input = fixture();

  delete input.secrets.nextjs_NEXTAUTH_SECRET;

  const result = resolveRuntime(input, ["nextjs"], runtimeKeys, () => { });

  assert.equal(result.secrets.nextjs_NEXTAUTH_SECRET.name, "projekt_nextjs_nextauth_secret_v1");
});

test("Unabhängige Bereitstellung benötigt keine Secrets anderer Services", () => {
  const inspected = [];
  const result = resolveRuntime({}, ["nginx"], runtimeKeys, name => inspected.push(name));

  assert.deepEqual(inspected, []);
  assert.deepEqual(result.services, { nginx: {} });
});

test("Fehlende Secrets werden ohne interne Fehlerdetails gemeldet", () => {
  assert.throws(() => resolveRuntime(fixture(), ["nextjs"], runtimeKeys, () => {
    throw new Error(ERROR_CONFIG.INVALID_ARGUMENTS.message);
  }), { message: ERROR_CONFIG.UNAVAILABLE_SECRET.message("database_r7") });
});

test("Nicht deklarierte Server-Einbindungen und Klartext-Secrets stoppen die Auflösung", () => {
  const input = fixture();

  input.services.nextjs.secrets.push({
    source: "manual",
    target: "runtime_MANUAL_TOKEN"
  });
  assert.throws(() => resolveRuntime(input, ["nextjs"], runtimeKeys, () => { }), {
    message: ERROR_CONFIG.UNDECLARED_SECRET.message("nextjs", "runtime_MANUAL_TOKEN")
  });

  input.services.nextjs.secrets.pop();
  input.services.nextjs.environment.NEXTAUTH_SECRET = "testwert";
  assert.throws(() => resolveRuntime(input, ["nextjs"], runtimeKeys, () => { }), {
    message: ERROR_CONFIG.PLAINTEXT_SECRET.message("nextjs", "NEXTAUTH_SECRET")
  });
});

test("Fehlende Startscript-Config stoppt vor der Docker-Prüfung", () => {
  const input = fixture();
  const inspected = [];

  delete input.configs.entrypoint;
  assert.throws(() => resolveRuntime(input, ["nextjs"], runtimeKeys, name => inspected.push(name)), {
    message: ERROR_CONFIG.MISSING_ENTRYPOINT.message("nextjs")
  });
  assert.deepEqual(inspected, []);
});

test("Deklaration enthält eindeutige Namen ohne öffentliche Secrets", () => {
  const names = [];

  for (const [
    service,
    definition
  ] of Object.entries(runtimeKeys)) {
    const keys = [
      ...definition.public,
      ...definition.secrets
    ];

    assert.equal(new Set(keys).size, keys.length);

    for (const key of definition.secrets) {
      assert.match(key, /^[A-Za-z_][A-Za-z0-9_]*$/);
      assert.ok(!key.startsWith("NEXT_PUBLIC_"));
      names.push(secretName(service, key));
    }
  }

  assert.equal(new Set(names).size, names.length);
});

test("Server-Bestand erhält sämtliche konfigurierten und laufenden Secret-Zuordnungen", () => {
  const inventory = JSON.parse(readFileSync(
    new URL("./fixtures/production-secret-inventory.json", import.meta.url),
    "utf8"
  ));
  const input = {
    services: {},
    secrets: {},
    // Der Export enthält keine Configs; für den Resolver eine Test-Config ergänzen.
    configs: { entrypoint: {
      external: true,
      name: "test_entrypoint"
    } }
  };

  for (const [
    service,
    configured
  ] of Object.entries(inventory.configured)) {
    assert.deepEqual(
      [...runtimeKeys[service].secrets].sort(),
      configured.secrets.map(secret => secret.target.slice("runtime_".length)).sort()
    );
    assert.ok(configured.public.every(key => runtimeKeys[service].public.includes(key)));

    input.services[service] = {
      environment: Object.fromEntries(configured.public.map(key => [
        key,
        "öffentlicher-testwert"
      ])),
      secrets: configured.secrets.map(secret => ({
        source: secret.source,
        target: secret.target
      })),
      configs: [{
        source: "entrypoint",
        target: "/production-entrypoint.sh"
      }]
    };

    for (const secret of configured.secrets) {
      input.secrets[secret.source] = {
        external: true,
        name: secret.name
      };
    }
  }

  const original = structuredClone(input);
  const inspected = [];
  const services = Object.keys(inventory.running).map(name => name.slice("projekt_".length));
  const output = resolveRuntime(input, services, runtimeKeys, name => inspected.push(name));

  assert.deepEqual(input, original);

  for (const service of services) {
    const running = inventory.running[`projekt_${service}`];
    const actual = Object.fromEntries((output.services[service].secrets || []).map(secret => [
      secret.target,
      output.secrets[secret.source].name
    ]));
    const expected = Object.fromEntries(running.secrets.map(secret => [
      secret.target,
      secret.name
    ]));

    assert.deepEqual(actual, expected, service);
    assert.ok(running.public.every(key => runtimeKeys[service]?.public.includes(key)));
  }

  assert.deepEqual(inspected.sort(), Object.values(inventory.running)
    .flatMap(service => service.secrets.map(secret => secret.name)).sort());
  assert.equal(output.secrets.nextjs_NEXTAUTH_SECRET.name, "projekt_nextauth_secret_1793284396714");
  assert.equal(output.secrets.nextjs_REDIS_URL.name, "projekt_nextjs_redis_url_r1");
});
