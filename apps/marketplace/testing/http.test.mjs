import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PrismaClient,
  InternalRole
} from "@prisma/client";
import { hashPassword } from "../lib/auth/password.mjs";


const base = "http://localhost:3001/marketplace";
const enabled = process.env.MARKETPLACE_TEST_DATABASE === "true";
const url = new URL(process.env.DATABASE_URL ?? "http://localhost");
if (enabled && (url.hostname !== "localhost" || url.port !== "55439"))
  throw new Error("Nur die isolierte Testdatenbank ist erlaubt.");

test("HTTP: Rollen, Session-Cookies, Filter und noindex", { skip: !enabled }, async () => {
  const db = new PrismaClient();
  try {
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.equal(home.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.match(await home.text(), /Ein guter Platz/);
    assert.equal((await fetch(`${base}/api/products?min=-1`)).status, 400);
    assert.equal((await fetch(`${base}/api/seller/offers`)).status, 401);
    assert.equal((await fetch(`${base}/api/observability/auth`)).status, 401);
    assert.equal((await fetch(`${base}/api/observability/auth`, {
      headers: { Cookie: "stellensuche.session-token=fremde-session" },
    })).status, 401);
    const password = "Nur-isolierter-Test-2026";
    const passwordHash = await hashPassword(password);
    for (const role of Object.values(InternalRole)) {
      const email = `${role.toLowerCase()}@marketplace-test.invalid`;
      await db.user.upsert({
        where: { email },
        create: {
          email,
          passwordHash,
          role,
        },
        update: {
          passwordHash,
          role,
        },
      });
      const csrfResponse = await fetch(`${base}/api/auth/csrf`);
      const { csrfToken } = await csrfResponse.json();
      const csrfCookies = csrfResponse.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      const login = await fetch(`${base}/api/auth/callback/credentials`, {
        method: "POST",
        headers: {
          Cookie: csrfCookies,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          csrfToken,
          email,
          password,
          callbackUrl: base,
          json: "true",
        }),
        redirect: "manual",
      });
      assert.equal(login.status, 200);
      const cookies = login.headers.getSetCookie();
      assert.ok(
        cookies.some((value) => value.includes("marketplace.session-token") && /Path=\/;/.test(value)),
      );
      const cookie = cookies.map((value) => value.split(";")[0]).join("; ");
      const session = await fetch(`${base}/api/auth/session`, { headers: { Cookie: cookie } }).then((response) =>
        response.json(),
      );
      assert.equal(session.user.role, role);
      const grafana = await fetch(`${base}/api/observability/auth`, { headers: { Cookie: cookie } });
      assert.equal(grafana.status, role === InternalRole.SUPER_ADMIN ? 204 : 403);
      if (role === InternalRole.SUPER_ADMIN) {
        assert.equal(grafana.headers.get("x-webauth-role"), "Admin");
        assert.equal(grafana.headers.get("x-webauth-user"), `marketplace-${session.user.id}`);
        assert.equal(grafana.headers.get("cache-control"), "no-store");
      } else {
        assert.equal(grafana.headers.get("x-webauth-user"), null);
      }
      const offers = await fetch(`${base}/api/seller/offers`, { headers: { Cookie: cookie } });
      assert.equal(offers.status, role === InternalRole.CUSTOMER ? 403 : 200);
      if (offers.status === 200) assert.deepEqual(await offers.json(), []);
      const admin = await fetch(`${base}/verwaltung`, {
        headers: { Cookie: cookie },
        redirect: "manual",
      });
      assert.equal(admin.status, role === InternalRole.SUPER_ADMIN ? 200 : 307);
      if (role !== InternalRole.SUPER_ADMIN)
        assert.equal(new URL(admin.headers.get("location"), base).pathname.replace(/\/$/, ""), "/marketplace");
      await db.user.update({
        where: { email },
        data: { sessionVersion: { increment: 1 } },
      });
      const revoked = await fetch(`${base}/api/auth/session`, { headers: { Cookie: cookie } }).then((response) =>
        response.json(),
      );
      assert.equal(revoked.user, undefined);
      assert.equal((await fetch(`${base}/api/observability/auth`, { headers: { Cookie: cookie } })).status, 401);
    }
  } finally {
    await db.$disconnect();
  }
});
