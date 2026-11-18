import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeTelemetry } from "../lib/observability/sanitize.ts";


test("Browser-Telemetrie entfernt Identitäten, URLs, SQL und Tokens rekursiv", () => {
  const actual = sanitizeTelemetry({
    user: { email: "person@test.invalid" },
    payload: {
      url: "https://app.test/account/42?token=secret",
      stack: "Fehler bei https://app.test/private/42?password=secret",
      attributes: [
        {
          key: "db.statement",
          value: { stringValue: "SELECT secret FROM users" },
        },
        {
          key: "http.status_code",
          value: { intValue: 500 },
        },
      ],
    },
  });
  const encoded = JSON.stringify(actual);

  for (const forbidden of [
    "person@test.invalid",
    "secret",
    "account/42",
    "private/42",
    "SELECT",
  ]) assert.equal(encoded.includes(forbidden), false);

  assert.equal(actual.payload.attributes[1].value.intValue, 500);
});
