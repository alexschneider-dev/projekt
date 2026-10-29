import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";


const require = createRequire(import.meta.url);
const guardUrl = new URL("../lib/auth/api-guard.ts", import.meta.url);
const guardRequire = createRequire(guardUrl);
const previous = require.extensions[".ts"];
let session;

const compile = source => ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

// Session-Abfrage und Navigation ersetzen; Rollen- und Fehlerlogik unverändert laden.
require.extensions[".ts"] = (module, filename) => {
  module._compile(compile(readFileSync(filename, "utf8")), filename);
};

let requireRole;
let redirectAfterAccessDenied;

try {
  const guardModule = { exports: {} };
  const dependencies = name => {
    if (name === "next-auth") return { getServerSession: async () => session };
    if (name === "./options") return { authOptions: {} };

    return guardRequire(name);
  };

  new Function("require", "module", "exports", compile(readFileSync(guardUrl, "utf8")))(
    dependencies,
    guardModule,
    guardModule.exports
  );
  requireRole = guardModule.exports.requireRole;

  const accessUrl = new URL("../lib/auth/access.ts", import.meta.url);
  const accessModule = { exports: {} };
  const accessDependencies = name => {
    if (name === "next/navigation") {
      return {
        redirect(destination) {
          throw { destination };
        },
      };
    }

    return guardRequire(name);
  };

  new Function("require", "module", "exports", compile(readFileSync(accessUrl, "utf8")))(
    accessDependencies,
    accessModule,
    accessModule.exports
  );
  redirectAfterAccessDenied = accessModule.exports.redirectAfterAccessDenied;
} finally {
  if (previous) require.extensions[".ts"] = previous;
  else delete require.extensions[".ts"];
}

test("API-Zugriff liefert 401 für fehlende oder unvollständige Sessions", async () => {
  for (const value of [
    null,
    {},
    { user: { role: "ADMIN" } },
  ]) {
    session = value;

    const apiGate = await requireRole("ADMIN");

    assert.equal(apiGate.ok, false);
    assert.equal(apiGate.response.status, 401);
    assert.equal((await apiGate.response.json()).code, "UNAUTHORIZED");
  }
});

test("Geschützte Seiten leiten ohne Anmeldung zum Login und ohne Berechtigung zur Homepage weiter", async () => {
  for (const [value, destination] of [
    [
      null,
      "/login",
    ],
    [
      {
        user: {
          id: "test-benutzer",
          role: "USER",
        },
      },
      "/",
    ],
  ]) {
    session = value;

    const apiGate = await requireRole("ADMIN");

    assert.equal(apiGate.ok, false);
    assert.throws(() => redirectAfterAccessDenied(apiGate.response), { destination });
  }
});

test("API-Zugriff verweigert unzureichende, fremde und fehlende Rollen", async () => {
  for (const role of [
    "USER",
    "customer_admin",
    "admin",
    undefined,
  ]) {
    session = {
      user: {
        id: "test-benutzer",
        role,
      },
    };

    const apiGate = await requireRole("ADMIN");

    assert.equal(apiGate.ok, false);
    assert.equal(apiGate.response.status, 403);
    assert.equal((await apiGate.response.json()).code, "FORBIDDEN");
  }
});

test("API-Zugriff berücksichtigt die Rollenhierarchie und gibt den Benutzer zurück", async () => {
  for (const role of [
    "ADMIN",
    "SUPER_ADMIN",
  ]) {
    session = {
      user: {
        id: "test-benutzer",
        role,
      },
    };

    const apiGate = await requireRole("ADMIN");

    assert.equal(apiGate.ok, true);
    assert.equal(apiGate.user, session.user);
  }

  session = {
    user: {
      id: "test-benutzer",
      role: "USER",
    },
  };

  assert.equal((await requireRole()).ok, true);
  assert.equal((await requireRole("SUPER_ADMIN")).ok, false);
});
