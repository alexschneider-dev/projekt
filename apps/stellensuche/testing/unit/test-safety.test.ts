import {
  expect,
  it,
} from "vitest";
import {
  assertTestDatabase,
  TEST_DATABASE_URL,
} from "../support/environment.mjs";
import { TEST_ERRORS } from "../errors/index.mjs";


it("Seed-Zugriffe sind ausschließlich auf die festgelegte Testdatenbank erlaubt", () => {
  expect(() => assertTestDatabase(TEST_DATABASE_URL)).not.toThrow();

  for (const url of [
    undefined,
    "",
    "postgresql://localhost:5432/postgres",
    "postgresql://projekt_test:projekt_test@datenbank.example.test:55432/projekt_test",
    `${TEST_DATABASE_URL}?schema=public`,
  ]) {
    expect(() => assertTestDatabase(url)).toThrow(TEST_ERRORS.UNSAFE_DATABASE);
  }
});
