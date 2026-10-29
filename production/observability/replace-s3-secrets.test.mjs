import { test } from "node:test";
import assert from "node:assert/strict";
import { replaceS3Secrets } from "./replace-s3-secrets.mjs";


const env = {
  OBS_SECRET_REVISION: "r1",
  GRAFANA_ROOT_URL: "https://monitor.test/grafana/",
  SMTP_HOST: "smtp.test:587",
  SMTP_USER: "monitor",
  SMTP_FROM: "monitor@test.invalid",
  ALERT_EMAIL_TO: "admin@test.invalid",
  LOKI_S3_BUCKET: "logs-projekt",
  LOKI_S3_ENDPOINT: "https://s3.eu-central-003.backblazeb2.com",
  LOKI_S3_REGION: "eu-central-003",
  AWS_CLI_IMAGE: "amazon/aws-cli:2.31.18",
};
const credentials = {
  s3AccessKey: "test-id",
  s3SecretKey: "test-secret",
};

function fixture(inUse = false) {
  const calls = [];
  const execute = (
    args,
    input
  ) => {
    calls.push({
      args,
      input,
    });
    if (args[0] === "service" && args[1] === "ls") return "service-id";
    if (args[0] === "service" && args[1] === "inspect") return JSON.stringify([{
      Spec: { TaskTemplate: { ContainerSpec: { Secrets: [{
        SecretName: inUse ? "projekt_obs_loki_s3_credentials_r1" : "projekt_obs_postgres_password_r1",
      }] } } },
    }]);
    if (args[0] === "secret" && args[1] === "ls") return [
      "projekt_obs_loki_s3_credentials_r1",
      "projekt_obs_thanos_s3_r1",
      "projekt_obs_postgres_password_r1",
    ].join("\n");
    return "";
  };
  return {
    calls,
    execute,
  };
}

test(
  "Nur S3-Secrets ersetzen und Zugangsdaten ausschließlich über stdin übergeben",
  () => {
    const {
      calls,
      execute,
    } = fixture();
    replaceS3Secrets(
      credentials,
      env,
      execute
    );
    const mutations = calls.filter(call => [
      "rm",
      "create",
    ].includes(call.args[1]));
    assert.equal(
      mutations.length,
      4
    );
    for (const call of mutations) {
      assert.match(
        call.args[2],
        /^projekt_obs_(loki_s3_credentials|thanos_s3)_r1$/
      );
      assert.equal(
        JSON.stringify(call.args).includes("test-secret"),
        false
      );
    }
    const thanos = JSON.parse(mutations[3].input);
    assert.equal(
      thanos.config.endpoint,
      "s3.eu-central-003.backblazeb2.com"
    );
    assert.equal(
      thanos.config.secret_key,
      "test-secret"
    );
  }
);

test(
  "Verwendete Secrets vor jeder Änderung ablehnen",
  () => {
    const {
      calls,
      execute,
    } = fixture(true);
    assert.throws(
      () => replaceS3Secrets(
        credentials,
        env,
        execute
      ),
      /Es wurde nichts geändert/
    );
    assert.equal(
      calls.some(call => call.args[0] === "secret"),
      false
    );
  }
);

test(
  "Unvollständige Zugangsdaten vor Docker-Aufrufen ablehnen",
  () => {
    const {
      calls,
      execute,
    } = fixture();
    assert.throws(
      () => replaceS3Secrets(
        { s3AccessKey: "test-id" },
        env,
        execute
      ),
      /S3-Zugangsdaten/
    );
    assert.equal(
      calls.length,
      0
    );
  }
);
