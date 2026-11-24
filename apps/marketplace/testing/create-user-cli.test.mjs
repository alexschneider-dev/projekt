import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { InternalRole } from "@prisma/client";
import { parseAccountArguments } from "../scripts/account-input.mjs";
import { ACCOUNT_ERRORS } from "../scripts/errors/account.mjs";


const roles = Object.values(InternalRole);
const defaultRole = roles.includes("CUSTOMER") ? "CUSTOMER" : "USER";

test("CLI normalisiert E-Mail und übernimmt Rolle und Namen", () => {
  assert.deepEqual(parseAccountArguments([
    "  INFO@Example.com ",
    "SUPER_ADMIN",
    "Alex Beispiel"
  ], roles, defaultRole), {
    email: "info@example.com",
    role: "SUPER_ADMIN",
    name: "Alex Beispiel"
  });
  assert.deepEqual(parseAccountArguments(["info@example.com"], roles, defaultRole), {
    email: "info@example.com",
    role: defaultRole,
    name: null
  });
});

test("CLI weist fehlende, falsche und zusätzliche Argumente zurück", () => {
  assert.throws(() => parseAccountArguments([], roles, defaultRole), { message: ACCOUNT_ERRORS.USAGE });
  assert.throws(() => parseAccountArguments(["falsch"], roles, defaultRole), { message: ACCOUNT_ERRORS.EMAIL });
  assert.throws(() => parseAccountArguments([
    "info@example.com",
    "ADMIN"
  ], roles, defaultRole), { message: ACCOUNT_ERRORS.ROLE });
  assert.throws(() => parseAccountArguments([
    "info@example.com",
    defaultRole,
    "Alex",
    "kein-passwortargument"
  ], roles, defaultRole), { message: ACCOUNT_ERRORS.USAGE });
});

test("Aufruf ohne Argumente liefert eine Anleitung statt eines Stacktraces", () => {
  const result = spawnSync(process.execPath, ["scripts/create-user.mjs"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(ACCOUNT_ERRORS.USAGE));
  assert.ok(!result.stderr.includes("ZodError"));
  assert.ok(!result.stderr.includes("at file:"));
});

test("Nichtinteraktive Eingabe wird vor Datenbankzugriffen abgewiesen", () => {
  const result = spawnSync(process.execPath, [
    "scripts/create-user.mjs",
    "info@example.com",
    "SUPER_ADMIN",
    "Alex"
  ], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
    input: "kein-passwort-aus-einer-pipe"
  });

  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(ACCOUNT_ERRORS.TERMINAL));
  assert.ok(!result.stderr.includes("kein-passwort-aus-einer-pipe"));
});
