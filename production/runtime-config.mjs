import {
  readFileSync,
  writeFileSync
} from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ERROR_CONFIG } from "./errors/config.mjs";


export const runtimeKeys = JSON.parse(readFileSync(new URL("./runtime-keys.json", import.meta.url), "utf8"));

export function secretName(service, key, revision = "v1") {
  const name = `projekt_${service}_${key.toLowerCase()}_${revision}`;

  if (!/^[a-zA-Z0-9_-]+$/.test(name) || name.length > 64) {
    throw new Error(ERROR_CONFIG.INVALID_SECRET_NAME.message(service, key));
  }

  return name;
}

function inspectSecret(name) {
  execFileSync("docker", [
    "secret",
    "inspect",
    name
  ], { stdio: "ignore" });
}

// Git definiert Einbindungen; der Server liefert öffentliche Werte und versionierte Namen.
export function resolveRuntime(input, services, definitions = runtimeKeys, inspect = inspectSecret) {
  const runtime = structuredClone(input);

  runtime.services = {};
  runtime.secrets = { ...input.secrets };

  for (const service of services) {
    const spec = structuredClone(input.services?.[service] || {});
    const definition = definitions[service];

    if (definition) {
      const keys = [
        ...definition.public,
        ...definition.secrets
      ];

      if (new Set(keys).size !== keys.length || definition.secrets.some(key =>
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || key.startsWith("NEXT_PUBLIC_"))) {
        throw new Error(ERROR_CONFIG.INVALID_RUNTIME_DEFINITION.message(service));
      }

      const entrypoint = spec.configs?.find(config => config.target === "/production-entrypoint.sh");

      if (!entrypoint || !input.configs?.[entrypoint.source]?.name) {
        throw new Error(ERROR_CONFIG.MISSING_ENTRYPOINT.message(service));
      }

      const previous = spec.secrets || [];
      const targets = new Set();

      for (const secret of previous) {
        const target = typeof secret === "string" ? secret : secret.target || secret.source;

        if (!target?.startsWith("runtime_") || !definition.secrets.includes(target.slice(8)) || targets.has(target)) {
          throw new Error(ERROR_CONFIG.UNDECLARED_SECRET.message(service, target));
        }
        targets.add(target);
      }

      spec.secrets = definition.secrets.map(key => {
        if (Object.hasOwn(spec.environment || {}, key)) {
          throw new Error(ERROR_CONFIG.PLAINTEXT_SECRET.message(service, key));
        }

        const alias = `${service}_${key}`;
        const existing = previous.find(secret => secret.target === `runtime_${key}`);
        const reference = input.secrets?.[existing?.source || alias];
        const name = reference?.name || secretName(service, key);

        try {
          inspect(name);
        } catch {
          throw new Error(ERROR_CONFIG.UNAVAILABLE_SECRET.message(name));
        }

        runtime.secrets[alias] = {
          external: true,
          name
        };

        return {
          source: alias,
          target: `runtime_${key}`
        };
      });
    }

    runtime.services[service] = spec;
  }

  return runtime;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [
    source,
    output,
    ...selected
  ] = process.argv.slice(2);

  if (!source || !output) throw new Error(ERROR_CONFIG.RUNTIME_ARGUMENTS.message);

  const input = JSON.parse(readFileSync(source, "utf8"));
  const services = selected.length ? selected : Object.keys(runtimeKeys);
  const runtime = resolveRuntime(input, services);

  writeFileSync(output, JSON.stringify(runtime, null, 2) + "\n", { mode: 0o600 });
}
