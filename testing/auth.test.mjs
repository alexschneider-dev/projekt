import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, dummyHash } from "../lib/auth/password.mjs";
import { hasRole } from "../lib/auth/roles.ts";


test("passwords use unique salts and reject incorrect passwords", async () => {
  const password = "Ein langes Passwort 🔑";
  const first = await hashPassword(password);
  const second = await hashPassword(password);

  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("Falsches Passwort", first), false);
  assert.equal(await verifyPassword(password, "broken"), false);
  assert.equal(await verifyPassword(password, dummyHash), false);
  assert.equal(await verifyPassword("x".repeat(129), first), false);
});

test("password creation enforces bounds without silently trimming", async () => {
  await assert.rejects(hashPassword("short"));
  await assert.rejects(hashPassword("x".repeat(129)));

  const encoded = await hashPassword("  password with spaces  ");

  assert.equal(await verifyPassword("  password with spaces  ", encoded), true);
  assert.equal(await verifyPassword("password with spaces", encoded), false);
});

test("internal role matrix denies escalation and unknown/customer roles", () => {
  for (const [role, user, admin, superAdmin] of [
    ["USER", true, false, false],
    ["ADMIN", true, true, false],
    ["SUPER_ADMIN", true, true, true],
    ["customer_admin", false, false, false],
    ["owner", false, false, false],
    ["", false, false, false],
  ]) {
    assert.equal(hasRole(role, "USER"), user);
    assert.equal(hasRole(role, "ADMIN"), admin);
    assert.equal(hasRole(role, "SUPER_ADMIN"), superAdmin);
  }
});

test("shared login schema normalizes only email and strips unexpected fields", async () => {
  const { loginSchema } = await import("../lib/schemas/auth/login.schema.ts");
  const result = loginSchema.parse({
    email: "  USER@Example.com  ",
    password: "  password with spaces  ",
    role: "SUPER_ADMIN",
  });

  assert.deepEqual(result, {
    email: "user@example.com",
    password: "  password with spaces  ",
  });

  for (const credentials of [
    undefined,
    { email: "invalid", password: "password" },
    { email: "user@example.com", password: "" },
    { email: "user@example.com", password: "x".repeat(129) },
    { email: "user@example.com", password: 123 },
  ]) {
    assert.equal(loginSchema.safeParse(credentials).success, false);
  }
});

test("React Hook Form resolver exposes field errors and normalized submit values", async () => {
  const { zodResolver } = await import("@hookform/resolvers/zod");
  const { loginSchema } = await import("../lib/schemas/auth/login.schema.ts");
  const resolver = zodResolver(loginSchema);
  const options = { fields: {}, shouldUseNativeValidation: false };
  const invalid = await resolver({ email: "", password: "" }, undefined, options);

  assert.equal(invalid.errors.email.message, "Bitte gib deine E-Mail-Adresse ein.");
  assert.equal(invalid.errors.password.message, "Bitte gib dein Passwort ein.");
  assert.deepEqual(invalid.values, {});

  const valid = await resolver({
    email: " USER@Example.com ",
    password: " password ",
  }, undefined, options);

  assert.deepEqual(valid.errors, {});
  assert.deepEqual(valid.values, {
    email: "user@example.com",
    password: " password ",
  });
});
