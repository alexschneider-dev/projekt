export const ERROR_CONFIG = {
  INVALID_SECRET_NAME: {
    status: 400,
    code: "INVALID_SECRET_NAME",
    message: (service, key) => `Ungültiger Secret-Name: ${service}.${key}`,
  },
  UNAVAILABLE_SECRET: {
    status: 400,
    code: "UNAVAILABLE_SECRET",
    message: name => `Docker-Secret fehlt oder ist nicht zugänglich: ${name}`,
  },
  PLAINTEXT_SECRET: {
    status: 400,
    code: "PLAINTEXT_SECRET",
    message: (service, key) => `Secret steht zusätzlich im Klartext-Environment: ${service}.${key}`,
  },
  UNDECLARED_SECRET: {
    status: 400,
    code: "UNDECLARED_SECRET",
    message: (service, target) => `Server-Secret nicht in Git deklariert: ${service}.${target}; Bestand abgleichen`,
  },
  MISSING_ENTRYPOINT: {
    status: 400,
    code: "MISSING_ENTRYPOINT",
    message: service => `Startscript-Config fehlt: ${service}; runtime.json vorbereiten`,
  },
  INVALID_RUNTIME_DEFINITION: {
    status: 400,
    code: "INVALID_RUNTIME_DEFINITION",
    message: service => `Ungültige oder doppelte Laufzeitdeklaration: ${service}`,
  },
  MISSING_RUNTIME_SECRET: {
    status: 400,
    code: "MISSING_RUNTIME_SECRET",
    message: (service, key) => `Pflicht-Secret fehlt: ${service}.${key}`,
  },
  UNKNOWN_RUNTIME_KEY: {
    status: 400,
    code: "UNKNOWN_RUNTIME_KEY",
    message: (service, key) => `Unbekannte Laufzeitvariable: ${service}.${key}; in runtime-keys.json deklarieren`,
  },
  RUNTIME_ARGUMENTS: {
    status: 400,
    code: "RUNTIME_ARGUMENTS",
    message: "Verwendung: node runtime-config.mjs EINGABE.json AUSGABE.json [SERVICE ...]",
  },
  INVALID_ARGUMENTS: {
    status: 400,
    code: "INVALID_ARGUMENTS",
    message: "Verwendung: node prepare-config.mjs ENV_VERZEICHNIS AUSGABE.json REVISION [--apply]",
  },
  INVALID_SECRET: {
    status: 400,
    code: "INVALID_SECRET",
    message: (service, key) => `Nicht unterstützter Secret-Schlüssel oder -Wert: ${service}.${key}`,
  },
  DUPLICATE_SECRET_NAME: {
    status: 409,
    code: "DUPLICATE_SECRET_NAME",
    message: "Mehrere Secrets haben denselben Namen",
  },
};
