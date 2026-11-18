import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSettings } from "./settings.mjs";


const valid = {
  OBS_SECRET_REVISION: "r1",
  GRAFANA_ROOT_URL: "https://monitor.test/grafana/",
  SMTP_HOST: "smtp.test:587",
  SMTP_USER: "monitor",
  SMTP_FROM: "monitor@test.invalid",
  ALERT_EMAIL_TO: "admin@test.invalid",
  LOKI_S3_BUCKET: "monitoring",
  LOKI_S3_ENDPOINT: "https://s3.test",
  LOKI_S3_REGION: "region-1",
  AWS_CLI_IMAGE: "amazon/aws-cli:2.31.18",
};

test(
  "Einstellungen ohne Elasticsearch werden akzeptiert",
  () => {
    assert.doesNotThrow(() => validateSettings(valid));
  }
);

test(
  "Platzhalter, Geheimnisse in URLs und unsichere S3-Endpunkte werden abgewiesen",
  () => {
    for (const patch of [
      { SMTP_HOST: "REPLACE_WITH_HOST" },
      { LOKI_S3_ENDPOINT: "http://s3.test" },
      { LOKI_S3_ENDPOINT: "https://user:secret@s3.test" },
      { OBS_SECRET_REVISION: "../../secret" },
      { OBS_S3_SECRET_REVISION: "../../secret" },
      { GRAFANA_ROOT_URL: "https://monitor.test/" },
    ]) {
      assert.throws(() => validateSettings({
        ...valid,
        ...patch,
      }));
    }
  }
);
