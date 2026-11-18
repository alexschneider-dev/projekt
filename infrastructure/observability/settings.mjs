import { ERRORS } from "./errors/messages.mjs";


export function validateSettings(env) {
  const keys = [
    "OBS_SECRET_REVISION",
    "GRAFANA_ROOT_URL",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_FROM",
    "ALERT_EMAIL_TO",
    "LOKI_S3_BUCKET",
    "LOKI_S3_ENDPOINT",
    "LOKI_S3_REGION",
    "AWS_CLI_IMAGE",
  ];

  for (const key of keys) {
    if (!env[key] || /REPLACE_WITH|example\.com|[\r\n]/i.test(env[key])) {
      throw new Error(ERRORS.SETTINGS);
    }
  }

  if (!/^[a-z0-9-]{1,24}$/.test(env.OBS_SECRET_REVISION)) {
    throw new Error(ERRORS.SETTINGS);
  }

  if (env.OBS_S3_SECRET_REVISION && !/^[a-z0-9-]{1,24}$/.test(env.OBS_S3_SECRET_REVISION)) {
    throw new Error(ERRORS.SETTINGS);
  }

  for (const key of [
    "GRAFANA_ROOT_URL",
    "LOKI_S3_ENDPOINT",
  ]) {
    let url;

    try {
      url = new URL(env[key]);
    } catch {
      throw new Error(ERRORS.SETTINGS);
    }

    if (url.username || url.password || url.search || url.hash ||
      ![
        "https:",
        "http:"
      ].includes(url.protocol) ||
      url.protocol !== "https:" ||
      (key === "LOKI_S3_ENDPOINT" && url.pathname !== "/") ||
      (key === "GRAFANA_ROOT_URL" && url.pathname !== "/grafana/")) {
      throw new Error(ERRORS.SETTINGS);
    }
  }
}
