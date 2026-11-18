import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { validateSettings } from "./settings.mjs";
import { ERRORS } from "./errors/messages.mjs";


validateSettings(process.env);

const [
  source,
  destination
] = process.argv.slice(2);

if (!source || !destination) throw new Error(ERRORS.INPUT);

let credentials;

try {
  credentials = JSON.parse(await readFile(source, "utf8"));
} catch {
  throw new Error(ERRORS.CREDENTIALS);
}

if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
  throw new Error(ERRORS.CREDENTIALS);
}

for (const key of [
  "s3AccessKey",
  "s3SecretKey",
  "smtpPassword",
]) {
  if (typeof credentials[key] !== "string" || !credentials[key].trim() || /[\r\n]/.test(credentials[key])) {
    throw new Error(ERRORS.CREDENTIALS);
  }
}

const directory = resolve(destination);

await mkdir(directory, { mode: 0o700 });

const write = (name, value) => writeFile(resolve(directory, name), value, {
  flag: "wx",
  mode: 0o600,
});
const postgres = randomBytes(32).toString("hex");
const aws = `[default]\naws_access_key_id = ${credentials.s3AccessKey}\naws_secret_access_key = ${credentials.s3SecretKey}\n`;
const secrets = {
  grafana_admin_password: randomBytes(32).toString("hex"),
  postgres_password: postgres,
  smtp_password: credentials.smtpPassword,
  loki_s3_credentials: aws,
  thanos_s3: JSON.stringify({
    type: "S3",
    prefix: "projekt/production/metrics",
    config: {
      bucket: process.env.LOKI_S3_BUCKET,
      endpoint: new URL(process.env.LOKI_S3_ENDPOINT).host,
      region: process.env.LOKI_S3_REGION,
      access_key: credentials.s3AccessKey,
      secret_key: credentials.s3SecretKey,
      insecure: false,
      bucket_lookup_type: "path",
    },
  }),
};

await write(
  "postgres-role.sql",
  `CREATE ROLE observability LOGIN PASSWORD '${postgres}' CONNECTION LIMIT 5;\nGRANT pg_monitor TO observability;\n`
);

for (const [
  name,
  value
] of Object.entries(secrets)) {
  const revision = [
    "loki_s3_credentials",
    "thanos_s3",
  ].includes(name)
    ? process.env.OBS_S3_SECRET_REVISION || process.env.OBS_SECRET_REVISION
    : process.env.OBS_SECRET_REVISION;
  const result = spawnSync("docker", [
    "secret",
    "create",
    `projekt_obs_${name}_${revision}`,
    "-",
  ], {
    input: value,
    encoding: "utf8",
    stdio: [
      "pipe",
      "ignore",
      "ignore",
    ],
  });

  if (result.status !== 0) throw new Error(ERRORS.SECRET);
}

console.log("Secrets erstellt. PostgreSQL-Rolle gemäß Anleitung installieren.");
