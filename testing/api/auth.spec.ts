import {
  test,
  expect,
  login,
} from "../support/fixtures";
import {
  USER,
  ADMIN,
  SUPER_ADMIN,
} from "@/lib/auth/roles";
import { ROUTES } from "@/lib/constants/routes";
import { HTTP_STATUS } from "@/lib/http/status";
import { ERROR_AUTH } from "@/lib/http/errors/auth";
import { TEST_PASSWORD } from "../support/environment.mjs";
import { GRAFANA_ROLES } from "@/lib/observability/roles";


test("geschützte API lehnt anonyme Anfragen ohne interne Details ab", async ({ request }) => {
  const response = await request.get(ROUTES.observabilityAuth);

  expect(response.status()).toBe(HTTP_STATUS.UNAUTHORIZED);
  expect(await response.json()).toMatchObject({
    code: ERROR_AUTH.UNAUTHORIZED.code,
    error: ERROR_AUTH.UNAUTHORIZED.message,
  });
  expect(await response.text()).not.toMatch(/stack|passwordHash|prisma|DATABASE_URL/i);
  expect(response.headers()["x-webauth-user"]).toBeUndefined();
});

for (const role of [
  USER,
  ADMIN,
  SUPER_ADMIN,
] as const) {
  test(`API-Berechtigung für ${role}`, async ({
    request,
    createAccount
  }) => {
    const account = await createAccount({ role });

    expect((await login(request, account.email)).ok()).toBe(true);

    const session = await (await request.get(ROUTES.authSession)).json();

    expect(session.user.role).toBe(role);
    expect(session.user.passwordHash).toBeUndefined();

    const response = await request.get(ROUTES.observabilityAuth);

    if (role === SUPER_ADMIN) {
      expect(response.status()).toBe(HTTP_STATUS.NO_CONTENT);
      expect(response.headers()["x-webauth-user"]).toBe(`projekt-${account.id}`);
      expect(response.headers()["x-webauth-role"]).toBe(GRAFANA_ROLES.ADMIN);
      expect(response.headers()["cache-control"]).toContain("no-store");
    } else {
      expect(response.status()).toBe(HTTP_STATUS.FORBIDDEN);
      expect((await response.json()).code).toBe(ERROR_AUTH.FORBIDDEN.code);
    }
  });
}

test("falsches Passwort und deaktivierte Konten erhalten keine Session", async ({
  request,
  createAccount
}) => {
  const active = await createAccount();
  const inactive = await createAccount({ active: false });

  await login(request, active.email, "Falsches Passwort");
  expect((await (await request.get(ROUTES.authSession)).json()).user).toBeUndefined();

  await login(request, inactive.email);
  expect((await (await request.get(ROUTES.authSession)).json()).user).toBeUndefined();
});

test("Session wird bei Versionswechsel und Kontodeaktivierung ungültig", async ({
  request,
  createAccount,
  database
}) => {
  const account = await createAccount({ role: SUPER_ADMIN });

  await login(request, account.email);
  expect((await request.get(ROUTES.observabilityAuth)).status()).toBe(HTTP_STATUS.NO_CONTENT);

  await database.user.update({
    where: { id: account.id },
    data: { sessionVersion: { increment: 1 } },
  });
  expect((await request.get(ROUTES.observabilityAuth)).status()).toBe(HTTP_STATUS.UNAUTHORIZED);

  await login(request, account.email);
  expect((await request.get(ROUTES.observabilityAuth)).status()).toBe(HTTP_STATUS.NO_CONTENT);

  await database.user.update({
    where: { id: account.id },
    data: { active: false },
  });
  expect((await request.get(ROUTES.observabilityAuth)).status()).toBe(HTTP_STATUS.UNAUTHORIZED);
});

test("das Login-Limit verhindert weitere Anmeldungen nach zehn Versuchen", async ({
  request,
  createAccount
}) => {
  const account = await createAccount();

  for (let attempt = 0; attempt < 10; attempt++) {
    await login(request, account.email, "Falsches Passwort");
  }

  await login(request, account.email);
  expect((await (await request.get(ROUTES.authSession)).json()).user).toBeUndefined();
});

test("Anmeldung ohne CSRF-Token erzeugt keine Session", async ({
  request,
  createAccount
}) => {
  const account = await createAccount();

  await request.post(ROUTES.authCredentials, {
    form: {
      email: account.email,
      password: TEST_PASSWORD,
      json: "true",
    },
  });

  expect((await (await request.get(ROUTES.authSession)).json()).user).toBeUndefined();
});

test("Telemetrie-Konfiguration liefert nur öffentliche Einstellungen", async ({ request }) => {
  const response = await request.get(ROUTES.telemetryConfig);

  expect(response.status()).toBe(HTTP_STATUS.OK);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toMatchObject({
    enabled: false,
    environment: "production",
  });
});

test("die migrierte Datenbank erzwingt eindeutige E-Mail-Adressen", async ({
  createAccount,
  database
}) => {
  const account = await createAccount();

  await expect(database.user.create({
    data: {
      email: account.email,
      passwordHash: account.passwordHash,
    },
  })).rejects.toMatchObject({ code: "P2002" });
});

test("ungültige Anmeldedaten werden auch direkt an der API abgewiesen", async ({ request }) => {
  for (const email of [
    "",
    "keine-email",
    `${"a".repeat(250)}@example.test`,
  ]) {
    const response = await login(request, email);

    expect(response.status()).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect((await (await request.get(ROUTES.authSession)).json()).user).toBeUndefined();
  }
});

test("eine Rollenänderung wirkt sofort auf eine bestehende Session", async ({
  request,
  createAccount,
  database,
}) => {
  const account = await createAccount({ role: SUPER_ADMIN });

  await login(request, account.email);
  expect((await request.get(ROUTES.observabilityAuth)).status()).toBe(HTTP_STATUS.NO_CONTENT);

  await database.user.update({
    where: { id: account.id },
    data: { role: USER },
  });
  expect((await request.get(ROUTES.observabilityAuth)).status()).toBe(HTTP_STATUS.FORBIDDEN);
});

test("gefälschte Benutzer- und Rollenheader ersetzen keine Anmeldung", async ({ request }) => {
  const response = await request.get(ROUTES.observabilityAuth, {
    headers: {
      "X-Webauth-User": "projekt-test",
      "X-Webauth-Role": GRAFANA_ROLES.ADMIN,
    },
  });

  expect(response.status()).toBe(HTTP_STATUS.UNAUTHORIZED);
});
