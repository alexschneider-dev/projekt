export const ERROR_CONFIG = {
  INVALID_ARGUMENTS: {
    status: 400,
    code: "INVALID_ARGUMENTS",
    message: "Verwendung: node prepare-config.mjs ENV_VERZEICHNIS AUSGABE.json REVISION [--apply]",
  },
  INVALID_SECRET: {
    status: 400,
    code: "INVALID_SECRET",
    message: (
      service,
      key
    ) => `Nicht unterstützter Secret-Schlüssel oder -Wert: ${service}.${key}`,
  },
  SECRET_NAME_TOO_LONG: {
    status: 400,
    code: "SECRET_NAME_TOO_LONG",
    message: (
      service,
      key
    ) => `Secret-Name zu lang: ${service}.${key}; kürzere Revision verwenden`,
  },
  DATABASE_URL_MISSING: {
    status: 400,
    code: "DATABASE_URL_MISSING",
    message: "nextjs.env muss DATABASE_URL enthalten",
  },
  POSTGRES_PASSWORD_MISSING: {
    status: 400,
    code: "POSTGRES_PASSWORD_MISSING",
    message: "postgres.env muss POSTGRES_PASSWORD enthalten",
  },
  DUPLICATE_SECRET_NAME: {
    status: 409,
    code: "DUPLICATE_SECRET_NAME",
    message: "Mehrere Secrets haben denselben Namen",
  },
};
