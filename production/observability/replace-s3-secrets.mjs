import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { validateSettings } from "./settings.mjs";
import { ERRORS } from "./errors/messages.mjs";


function docker(
  args,
  input
) {
  const result = spawnSync(
    "docker",
    args,
    {
      input,
      encoding: "utf8",
      stdio: [
        "pipe",
        "pipe",
        "pipe",
      ],
    }
  );
  if (result.status !== 0) throw new Error(ERRORS.S3_REPLACE);
  return result.stdout.trim();
}

export function replaceS3Secrets(
  credentials,
  env,
  execute = docker
) {
  validateSettings(env);
  for (const key of [
    "s3AccessKey",
    "s3SecretKey",
  ]) {
    if (typeof credentials?.[key] !== "string" ||
      !credentials[key].trim() || /[\r\n]/.test(credentials[key])) {
      throw new Error(ERRORS.S3_CREDENTIALS);
    }
  }
  const values = {
    loki_s3_credentials: `[default]\naws_access_key_id = ${credentials.s3AccessKey}\naws_secret_access_key = ${credentials.s3SecretKey}\n`,
    thanos_s3: JSON.stringify({
      type: "S3",
      prefix: "projekt/production/metrics",
      config: {
        bucket: env.LOKI_S3_BUCKET,
        endpoint: new URL(env.LOKI_S3_ENDPOINT).host,
        region: env.LOKI_S3_REGION,
        access_key: credentials.s3AccessKey,
        secret_key: credentials.s3SecretKey,
        insecure: false,
        bucket_lookup_type: "path",
      },
    }),
  };
  const names = Object.keys(values).map(name => `projekt_obs_${name}_${env.OBS_SECRET_REVISION}`);
  // Vor jeder Änderung prüfen; auch gestoppte Services halten Secret-Referenzen.
  const ids = execute([
    "service",
    "ls",
    "-q",
  ]).split(/\s+/).filter(Boolean);
  if (ids.length) {
    const services = JSON.parse(execute([
      "service",
      "inspect",
      ...ids,
    ]));
    if (services.some(service =>
      (service.Spec?.TaskTemplate?.ContainerSpec?.Secrets ?? []).some(secret =>
        names.includes(secret.SecretName)))) {
      throw new Error(ERRORS.S3_IN_USE);
    }
  }
  const existing = new Set(execute([
    "secret",
    "ls",
    "--format",
    "{{.Name}}",
  ]).split(/\s+/));
  for (const [
    key,
    value,
  ] of Object.entries(values)) {
    const name = `projekt_obs_${key}_${env.OBS_SECRET_REVISION}`;
    if (existing.has(name)) execute([
      "secret",
      "rm",
      name,
    ]);
    execute(
      [
        "secret",
        "create",
        name,
        "-",
      ],
      value
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let credentials;
  try {
    credentials = JSON.parse(await readFile(
      process.argv[2],
      "utf8"
    ));
  } catch {
    throw new Error(ERRORS.S3_CREDENTIALS);
  }
  replaceS3Secrets(
    credentials,
    process.env
  );
  console.log("Die beiden S3-Secrets wurden ersetzt. Andere Secrets bleiben unverändert.");
}
