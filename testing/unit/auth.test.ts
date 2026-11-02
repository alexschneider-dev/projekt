import {
  describe,
  expect,
  it,
} from "vitest";
import {
  USER,
  ADMIN,
  SUPER_ADMIN,
  hasRole,
} from "@/lib/auth/roles";
import { loginSchema } from "@/lib/schemas/auth/login.schema";
import { ERROR_VALIDATION } from "@/lib/http/errors/validation.mjs";


describe("Interne Rollen", () => {
  it.each([
    [
      USER,
      USER,
      true
    ],
    [
      USER,
      ADMIN,
      false
    ],
    [
      USER,
      SUPER_ADMIN,
      false
    ],
    [
      ADMIN,
      USER,
      true
    ],
    [
      ADMIN,
      ADMIN,
      true
    ],
    [
      ADMIN,
      SUPER_ADMIN,
      false
    ],
    [
      SUPER_ADMIN,
      USER,
      true
    ],
    [
      SUPER_ADMIN,
      ADMIN,
      true
    ],
    [
      SUPER_ADMIN,
      SUPER_ADMIN,
      true
    ],
    [
      "customer_admin",
      USER,
      false
    ],
    [
      "",
      USER,
      false
    ],
  ] as const)("%s benötigt %s: %s", (role, required, allowed) => {
    expect(hasRole(role, required)).toBe(allowed);
  });
});

describe("Login-Validierung", () => {
  it("normalisiert nur die E-Mail und entfernt zusätzliche Eigenschaften", () => {
    expect(loginSchema.parse({
      email: " USER@Example.test ",
      password: " Passwort mit Leerzeichen ",
      role: SUPER_ADMIN,
    })).toEqual({
      email: "user@example.test",
      password: " Passwort mit Leerzeichen ",
    });
  });

  it.each([
    [
      "",
      "passwort",
      ERROR_VALIDATION.EMAIL_REQUIRED.message
    ],
    [
      "ungueltig",
      "passwort",
      ERROR_VALIDATION.EMAIL_INVALID.message
    ],
    [
      `${"a".repeat(250)}@example.test`,
      "passwort",
      ERROR_VALIDATION.EMAIL_TOO_LONG.message
    ],
    [
      "user@example.test",
      "",
      ERROR_VALIDATION.PASSWORD_REQUIRED.message
    ],
    [
      "user@example.test",
      "a".repeat(129),
      ERROR_VALIDATION.PASSWORD_TOO_LONG.message
    ],
  ])("weist ungültige Eingaben zurück", (email, password, message) => {
    const result = loginSchema.safeParse({
      email,
      password,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(issue => issue.message)).toContain(message);
  });
});
