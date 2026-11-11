import {
  runtimeKeys,
  secretName
} from "./runtime-config.mjs";
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
const [
  envDirectory,
  output,
  revision,
  mode
] = process.argv.slice(2);

if (!envDirectory || !output || !/^[a-z0-9][a-z0-9-]{0,24}$/.test(revision || "") ||
  (mode && mode !== "--apply")) {
  throw new Error(ERROR_CONFIG.INVALID_ARGUMENTS.message);
}

const root = dirname(fileURLToPath(import.meta.url));
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

for (const service of Object.keys(runtimeKeys)) {
  const values = parseEnv(readFileSync(resolve(envDirectory, `${service}.env`), "utf8"));
  const spec = {
    environment: {},
    secrets: [],
    configs: [{
      source: "production_entrypoint",
      target: "/production-entrypoint.sh",
      mode: 292
    }],
  };

  for (const [
    key,
    value
  ] of Object.entries(values)) {
    if (runtimeKeys[service].public.includes(key) || key.startsWith("NEXT_PUBLIC_")) {
      // Docker Compose ersetzt Dollarzeichen auch in JSON-Eingaben.
      const publicKey = key;

      spec.environment[publicKey] = value.replaceAll("$", () => "$$");
    } else {
      if (!runtimeKeys[service].secrets.includes(key)) {
        throw new Error(ERROR_CONFIG.UNKNOWN_RUNTIME_KEY.message(service, key));
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || value.includes("\0")) {
        throw new Error(ERROR_CONFIG.INVALID_SECRET.message(service, key));
      }

      const alias = `${service}_${key}`;
      const name = secretName(service, key, revision);

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

  for (const key of runtimeKeys[service].secrets) {
    if (!manifest.secrets[`${service}_${key}`]) {
      throw new Error(ERROR_CONFIG.MISSING_RUNTIME_SECRET.message(service, key));
    }
  }

  manifest.services[service] = spec;
}

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
  for (const [
    service,
    spec
  ] of Object.entries(manifest.services)) {
    console.log(`${service}: öffentliche Variablen: ${Object.keys(spec.environment).join(", ")}`);
    console.log(`${service}: geheime Variablen: ${spec.secrets.map(s => s.target.slice(8)).join(", ")}`);
  }

  console.log("Nur Vorschau. runtime-keys.json prüfen, danach erneut mit --apply ausführen.");
}
