import { TEST_ERRORS } from "../errors/index.mjs";


// Absichtlich fest: Testskripte dürfen niemals DATABASE_URL aus der Arbeitsumgebung verwenden.
export const TEST_DATABASE_URL = "postgresql://projekt_test:projekt_test@127.0.0.1:55432/projekt_test";
export const TEST_BASE_URL = "http://127.0.0.1:3100";
export const TEST_PASSWORD = "Nur-fuer-lokale-Tests-2026!";
export const TEST_ENV = {
  DATABASE_URL: TEST_DATABASE_URL,
  NEXTAUTH_URL: TEST_BASE_URL,
  NEXTAUTH_SECRET: "ausschliesslich-lokales-testgeheimnis-keine-produktionsdaten",
  OBSERVABILITY_ENABLED: "false",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_TEST_BUILD: "true",
};

export function assertTestDatabase(url) {
  if (url !== TEST_DATABASE_URL) throw new Error(TEST_ERRORS.UNSAFE_DATABASE);
}
