import { TEST_ERRORS } from "../errors/index.mjs";


// Absichtlich fest: Testskripte dürfen niemals DATABASE_URL aus der Arbeitsumgebung verwenden.
export const TEST_DATABASE_URL = "postgresql://stellensuche_app:stellensuche_test_passwort_2026@127.0.0.1:55432/projekt_test?schema=stellensuche";
export const TEST_BASE_URL = "http://127.0.0.1:3100";
export const TEST_APP_URL = `${TEST_BASE_URL}/stellensuche`;
export const TEST_PASSWORD = "Nur-fuer-lokale-Tests-2026!";
export const TEST_ENV = {
  DATABASE_URL: TEST_DATABASE_URL,
  NEXTAUTH_URL: `${TEST_APP_URL}/api/auth`,
  NEXTAUTH_SECRET: "ausschliesslich-lokales-testgeheimnis-keine-produktionsdaten",
  OBSERVABILITY_ENABLED: "false",
  RESEND_API_KEY: "re_nur-fuer-lokale-tests",
  MAIL_FROM: "Projekt <noreply@example.test>",
  TRUST_PROXY: "false",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_TEST_BUILD: "true",
};

export function assertTestDatabase(url) {
  if (url !== TEST_DATABASE_URL) throw new Error(TEST_ERRORS.UNSAFE_DATABASE);
}
