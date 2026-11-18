import {
  afterAll,
  beforeEach,
  afterEach,
  expect,
  test,
  vi
} from "vitest";
import {
  createHash,
  randomUUID
} from "node:crypto";
import { prisma } from "@/lib/prisma";
import { POST as register } from "@/app/api/registration/route";
import { POST as resend } from "@/app/api/registration/resend/route";
import { POST as verify } from "@/app/api/registration/verify/route";
import { createSearch } from "@/scripts/jobs/limits.mjs";
import {
  saveNewUrls,
  importJobs
} from "@/scripts/jobs/import.mjs";
import {
  USER,
  SUPER_ADMIN
} from "@/lib/auth/roles";
import { verifyPassword } from "@/lib/auth/password.mjs";
import {
  TEST_DATABASE_URL,
  TEST_PASSWORD
} from "../support/environment.mjs";


const emails: string[] = [];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const email = () => {
  const value = `${randomUUID()}@example.test`;
  emails.push(value);
  return value;
};
const request = (data: unknown) => new Request("http://127.0.0.1:3100/api/registration", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
const messages: {
  to: string[];
  text: string
}[] = [];
const lastToken = () => messages.at(-1)!.text.match(/#([a-f0-9]{64})/)![1]!;
const limitKeys = [
  "mail:source:shared",
  "mail:global",
  "verify:source:shared",
  "verify:global"
];

beforeEach(async () => {
  expect(process.env.DATABASE_URL).toBe(TEST_DATABASE_URL);
  await prisma.loginAttempt.deleteMany({ where: { key: { in: limitKeys.map(key => hash(`registration:${key}`)) } } });
  messages.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers).toMatchObject({ Authorization: "Bearer re_nur-fuer-lokale-tests" });
    messages.push(JSON.parse(options.body as string));
    return Response.json({ id: randomUUID() });
  }));
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true }
  });
  const userId = { in: users.map(user => user.id) };
  await prisma.jobListing.deleteMany({ where: { userId } });
  await prisma.jobSearch.deleteMany({ where: { userId } });
  await prisma.jobImportState.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.pendingRegistration.deleteMany({ where: { email: { in: emails } } });
  await prisma.loginAttempt.deleteMany({
    where: {
      key: {
        in: [
          ...limitKeys,
          ...emails.map(e => `mail:email:${e}`)
        ].map(key => hash(`registration:${key}`))
      }
    }
  });
  await prisma.$disconnect();
});

test("Registrierung: Resend-Link, nur Hashes, Rotation, einmalige Bestätigung und ausschließlich USER", async () => {
  const address = email();
  const result = await register(request({
    email: address.toUpperCase(),
    password: TEST_PASSWORD,
    role: SUPER_ADMIN
  }), undefined);
  expect(result.status).toBe(200);
  expect(await prisma.user.findUnique({ where: { email: address } })).toBeNull();
  const oldToken = lastToken();
  const pending = await prisma.pendingRegistration.findUniqueOrThrow({ where: { email: address } });
  expect(pending.tokenHash).toBe(hash(oldToken));
  expect(pending.passwordHash).not.toBe(TEST_PASSWORD);
  expect(messages[0]!.to).toEqual([address]);
  expect(pending.expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
  expect((await resend(request({ email: address }), undefined)).status).toBe(200);
  expect((await verify(request({ token: oldToken }), undefined)).status).toBe(400);
  const token = lastToken();
  const confirmations = await Promise.all([
    verify(request({ token }), undefined),
    verify(request({ token }), undefined)
  ]);
  expect(confirmations.map(response => response.status).sort()).toEqual([
    200,
    400
  ]);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
  expect(user.role).toBe(USER);
  expect(user.active).toBe(true);
  expect(await verifyPassword(TEST_PASSWORD, user.passwordHash)).toBe(true);
  expect(await prisma.pendingRegistration.findUnique({ where: { email: address } })).toBeNull();
  const sent = messages.length;
  expect((await register(request({
    email: address,
    password: "Anderes-Passwort-2026"
  }), undefined)).status).toBe(200);
  expect(messages).toHaveLength(sent);
  expect((await prisma.user.findUniqueOrThrow({ where: { email: address } })).passwordHash).toBe(user.passwordHash);
});

test("Abgelaufene Token, ungültige Daten und Mailfehler erzeugen kein nutzbares Konto", async () => {
  const address = email();
  expect((await register(request({
    email: address,
    password: "kurz"
  }), undefined)).status).toBe(400);
  expect((await register(request({
    email: address,
    password: "x".repeat(5000)
  }), undefined)).status).toBe(400);
  await register(request({
    email: address,
    password: TEST_PASSWORD
  }), undefined);
  const token = lastToken();
  await prisma.pendingRegistration.update({
    where: { email: address },
    data: { expiresAt: new Date(0) }
  });
  expect((await verify(request({ token }), undefined)).status).toBe(400);
  expect(await prisma.user.findUnique({ where: { email: address } })).toBeNull();
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "geheime Anbieterantwort" }, { status: 429 })));
  const failed = await register(request({
    email: address,
    password: TEST_PASSWORD
  }), undefined);
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain("geheime Anbieterantwort");
  expect(await prisma.user.findUnique({ where: { email: address } })).toBeNull();
});

test("Registrierung und erneuter Versand teilen atomare E-Mail- und Quellenlimits", async () => {
  const address = email();
  const results = await Promise.all(Array.from({ length: 8 }, () => resend(request({ email: address }), undefined)));
  expect(results.filter(result => result.status === 200)).toHaveLength(3);
  const rejected = results.find(result => result.status === 429)!;
  expect(rejected.headers.get("Retry-After")).toBe("3600");
  const sourceResults = await Promise.all(Array.from({ length: 5 }, () => resend(request({ email: email() }), undefined)));
  expect(sourceResults.filter(result => result.status === 200)).toHaveLength(2);
  expect(messages).toHaveLength(0);
});

test("Gleichzeitige Suchanlagen und Importe überschreiten USER-Limits nicht", async () => {
  const user = await prisma.user.create({
    data: {
      email: email(),
      passwordHash: "",
      role: USER
    }
  });
  const searches = await Promise.allSettled(Array.from({ length: 4 }, (_, index) =>
    createSearch(prisma, {
      url: `https://www.stepstone.de/jobs/test-${index}`,
      title: "Test"
    }, user.id)));
  expect(searches.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(await prisma.jobSearch.count({ where: { userId: user.id } })).toBe(1);
  const saved = await Promise.all(Array.from({ length: 4 }, (_, group) => saveNewUrls(prisma,
    Array.from({ length: 60 }, (_, index) => `https://example.test/${group}/${index}`), user.id)));
  expect(saved.reduce((sum, count) => sum + count, 0)).toBe(100);
  await prisma.jobListing.updateMany({
    where: { userId: user.id },
    data: { status: "BEWORBEN" }
  });
  expect(await saveNewUrls(prisma, ["https://example.test/weiter"], user.id)).toBe(0);
  const fetchPage = vi.fn();
  const lock = { query: async () => ({ rows: [{ locked: true }] }) };
  await importJobs(prisma, lock, fetchPage, user.id);
  expect(fetchPage).not.toHaveBeenCalled();
  await prisma.user.update({
    where: { id: user.id },
    data: { role: SUPER_ADMIN }
  });
  expect(await saveNewUrls(prisma, ["https://example.test/weiter"], user.id)).toBe(1);
  expect(await createSearch(prisma, { url: "https://www.stepstone.de/jobs/unbegrenzt" }, user.id)).toBe(1);
});

test("USER-Import beendet Pagination nach 100 Stellen und speichert den Teilstand", async () => {
  const user = await prisma.user.create({
    data: {
      email: email(),
      passwordHash: "",
      role: USER
    }
  });
  await createSearch(prisma, {
    url: "https://www.stepstone.de/jobs/test",
    title: "Begrenzter Import"
  }, user.id);
  const loadPage = vi.fn(async (url: URL) => {
    const page = Number(url.searchParams.get("page"));
    return JSON.stringify({
      searchResultsDisplayedPageNumber: page,
      searchResultsTotalJobCount: 266,
      ssaResultsPerPage: 25
    })
      + Array.from({ length: 25 }, (_, index) => `<a data-at="job-item-title" href="https://www.stepstone.de/stellenangebote--Test--${page * 1000 + index}-inline.html">Stelle</a>`).join("");
  });
  const lock = { query: async () => ({ rows: [{ locked: true }] }) };
  await importJobs(prisma, lock, loadPage, user.id);
  expect(loadPage).toHaveBeenCalledTimes(4);
  expect(await prisma.jobListing.count({ where: { userId: user.id } })).toBe(100);
  expect(await prisma.jobSearch.findFirst({ where: { userId: user.id } })).toMatchObject({
    lastResultCount: 266,
    lastScannedCount: 100,
    lastScannedPages: 4,
    lastTotalPages: 11,
    lastScanComplete: false,
  });
  expect(await prisma.jobImportState.findUnique({ where: { userId: user.id } })).toMatchObject({ succeeded: true });
});
