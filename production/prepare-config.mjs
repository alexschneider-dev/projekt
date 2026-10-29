import { ERROR_CONFIG } from "./errors/config.mjs";
import {
  readFileSync,
  writeFileSync
} from "node:fs";
import {
  resolve,
  dirname
} from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";


// Benötigt util.parseEnv (Node 20.12+ oder 22+). Niemals Secret-Werte ausgeben.
const [envDirectory, output, revision, mode] = process.argv.slice(2);

if (!envDirectory || !output || !/^[a-z0-9][a-z0-9-]{0,24}$/.test(revision || "") ||
  (mode && mode !== "--apply")) {
  throw new Error(ERROR_CONFIG.INVALID_ARGUMENTS.message);
}

const root = dirname(fileURLToPath(import.meta.url));
const publicKeys = JSON.parse(readFileSync(resolve(root, "public-keys.json"), "utf8"));
const filenames = {
  nextjs: "nextjs",
  postgres: "postgres"
};
const entrypoints = {
  nextjs: ["docker-entrypoint.sh"],
  postgres: ["docker-entrypoint.sh"],
};
const commands = {
  nextjs: [
    "node",
    "server.js"
  ],
  postgres: ["postgres"]
};

const manifest = {
  version: "3.9",
  services: {},
  secrets: {},
  configs: {
    production_entrypoint: {
      external: true,
      name: `projekt_entrypoint_${revision}`
    },
  }
};
const pending = [];

for (const [service, filename] of Object.entries(filenames)) {
  const values = parseEnv(readFileSync(resolve(envDirectory, `${filename}.env`), "utf8"));
  const spec = {
    environment: {},
    secrets: [],
    command: commands[service],
    configs: [{
      source: "production_entrypoint",
      target: "/production-entrypoint.sh",
      mode: 292
    }],
    entrypoint: [
      "/bin/sh",
      "/production-entrypoint.sh",
      ...entrypoints[service]
    ],
  };

  for (const [key, value] of Object.entries(values)) {
    if (publicKeys[service].includes(key) || key.startsWith("NEXT_PUBLIC_")) {
      // Docker Compose ersetzt Dollarzeichen auch in JSON-Eingaben.
      const publicKey = key;

      spec.environment[publicKey] = value.replaceAll("$", () => "$$");
    } else {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || value.includes("\0")) {
        throw new Error(ERROR_CONFIG.INVALID_SECRET.message(service, key));
      }

      const alias = `${service}_${key}`;
      const name = `projekt_${service}_${key.toLowerCase()}_${revision}`;

      if (name.length > 64) throw new Error(ERROR_CONFIG.SECRET_NAME_TOO_LONG.message(service, key));

      manifest.secrets[alias] = {
        external: true,
        name
      };
      spec.secrets.push({
        source: alias,
        target: `runtime_${key}`
      });
      pending.push({
        name,
        value
      });
    }
  }

  manifest.services[service] = spec;
}

if (!manifest.secrets.nextjs_DATABASE_URL) throw new Error(ERROR_CONFIG.DATABASE_URL_MISSING.message);
if (!manifest.secrets.postgres_POSTGRES_PASSWORD) throw new Error(ERROR_CONFIG.POSTGRES_PASSWORD_MISSING.message);

// Bestehende Manifeste nicht überschreiben und unveränderliche Revisionen nicht wiederverwenden.
const docker = (args, input) => execFileSync("docker", args, {
  input,
  stdio: [
    "pipe",
    "pipe",
    "pipe"
  ],
  encoding: "utf8",
});

if (new Set(pending.map(({ name }) => name)).size !== pending.length) {
  throw new Error(ERROR_CONFIG.DUPLICATE_SECRET_NAME.message);
}

if (mode === "--apply") {
  // Ausgabepfad vor Änderungen an Swarm reservieren. Bei Fehlern bleibt eine
  // unvollständige Datei zurück; diese niemals für eine Bereitstellung verwenden.
  writeFileSync(output, "", {
    flag: "wx",
    mode: 0o600
  });

  for (const {
    name,
    value
  } of pending) {
    docker([
      "secret",
      "create",
      name,
      "-"
    ], value);
  }

  docker([
    "config",
    "create",
    manifest.configs.production_entrypoint.name,
    "-"
  ], readFileSync(resolve(root, "secrets-entrypoint.sh")));

  writeFileSync(output, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });

  console.log(`${pending.length} Secrets und ${output} erstellt. Ursprüngliche Env-Dateien bleiben erhalten.`);
} else {
  for (const [service, spec] of Object.entries(manifest.services)) {
    console.log(`${service}: öffentliche Variablen: ${Object.keys(spec.environment).join(", ")}`);
    console.log(`${service}: geheime Variablen: ${spec.secrets.map(s => s.target.slice(8)).join(", ")}`);
  }

  console.log("Nur Vorschau. public-keys.json prüfen, danach erneut mit --apply ausführen.");
}
