import {
  readFileSync,
  writeFileSync
} from "node:fs";


const [
  input,
  output,
  selectedService
] = process.argv.slice(2);
const runtime = JSON.parse(readFileSync(input, "utf8"));
const serviceNames = selectedService ? [selectedService] : [
  "nextjs",
  "nginx",
  "postgres",
  "redis"
];
const allowedFields = [
  "environment",
  "secrets",
  "configs"
];
const services = {};

// Nur Laufzeitwerte und Einbindungen ergänzen; die Betriebsparameter kommen aus Compose.
for (const name of serviceNames) {
  const source = runtime.services?.[name];
  if (!source) continue;
  services[name] = Object.fromEntries(
    allowedFields.filter(key => Object.hasOwn(source, key)).map(key => [
      key,
      source[key]
    ])
  );
}

const overlay = {
  version: "3.9",
  services,
  secrets: runtime.secrets ?? {},
  configs: runtime.configs ?? {}
};
writeFileSync(output, JSON.stringify(overlay, null, 2) + "\n", { mode: 0o600 });
