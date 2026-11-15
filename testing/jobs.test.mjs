import assert from "node:assert/strict";
import test from "node:test";
import { parseSearchPage } from "../scripts/jobs/parser.mjs";
import { waitForNextImport } from "../scripts/jobs/schedule.mjs";
import { jobErrorLog } from "../scripts/jobs/errors/log.mjs";
import { JOB_ERRORS } from "../scripts/jobs/errors/index.mjs";
import {
  importJobs,
  fetchPage,
  retryDelay,
  saveNewUrls,
} from "../scripts/jobs/import.mjs";


function fixture(page, total, ids) {
  const data = JSON.stringify({
    searchResultsDisplayedPageNumber: page,
    searchResultsTotalJobCount: total,
    ssaResultsPerPage: 25,
  }).replaceAll('"', "&#34;");
  const links = ids.map((id) => (
    `<a href="/stellenangebote--Test--${id}-inline.html?rltr=test&amp;tracking=1" data-at="job-item-title">Stelle</a>`
  )).join("");
  return `<div data-results="${data}">${links}</div>`;
}

test("Seitenzahl aufrunden, Links bereinigen und Duplikate entfernen", () => {
  const result = parseSearchPage(fixture(2, 55, [
    123,
    123,
  ]), 2);
  assert.equal(result.totalPages, 3);
  assert.deepEqual(result.urls, ["https://www.stepstone.de/stellenangebote--Test--123-inline.html"]);
});

test("Fehlerprotokoll zeigt Netzwerkursache und Kontext ohne sensible Meldungen", () => {
  const cause = Object.assign(new Error("postgres://user:geheim@host/db"), { code: "ECONNRESET" });
  const error = new TypeError("fetch failed", { cause });
  const log = jobErrorLog(error, {
    searchId: 7,
    page: 2,
    phase: "Suchseite abrufen",
  });
  const parsed = JSON.parse(log);
  assert.equal(parsed.searchId, 7);
  assert.equal(parsed.page, 2);
  assert.equal(parsed.causes[1].code, "ECONNRESET");
  assert.ok(!log.includes("geheim"));
  assert.equal(JSON.parse(jobErrorLog({
    name: "PrismaClientInitializationError",
    errorCode: "P1001",
  })).causes[0].code, "P1001");
});

test("HTTP-Weiterleitungen werden mit Status protokollierbar abgelehnt", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const mockedFetch = context.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.redirect, "manual");
    return new Response(null, { status: 302 });
  });
  const result = fetchPage(new URL("https://example.test/jobs"));
  const rejection = assert.rejects(result, (error) => {
    assert.equal(error.message, JOB_ERRORS.redirect);
    assert.equal(JSON.parse(jobErrorLog(error)).httpStatus, 302);
    return true;
  });
  context.mock.timers.tick(10_000);
  await rejection;
  assert.equal(mockedFetch.mock.callCount(), 1);
});

test("Leere Suche zulassen, unlesbare Antworten und falsche Seiten ablehnen", () => {
  assert.equal(parseSearchPage(fixture(1, 0, []), 1).urls.length, 0);
  assert.throws(() => parseSearchPage("<html>Zugriff gesperrt</html>", 1));
  assert.throws(() => parseSearchPage(fixture(1, 55, [123]), 2));
  assert.throws(() => parseSearchPage(fixture(1, 55, []), 1));
});

function databaseStub() {
  return {
    jobImportState: { update: async () => ({}) },
    jobSearch: {
      findMany: async () => [{
        id: 1,
        url: "https://www.stepstone.de/jobs/test",
      }],
      updateMany: async () => ({ count: 1 }),
    },
    jobListing: {
      findMany: async () => [],
      createMany: async () => ({ count: 1 }),
    },
  };
}

test("Vorhandene Links bleiben unverändert; nur neue Links einfügen", async () => {
  let inserted;
  const database = databaseStub();
  database.jobListing.findMany = async () => [{ url: "bekannt" }];
  database.jobListing.createMany = async (options) => {
    inserted = options;
    return { count: 1 };
  };
  assert.equal(await saveNewUrls(database, [
    "bekannt",
    "neu",
    "neu",
  ]), 1);
  assert.deepEqual(inserted, {
    data: [{ url: "neu" }],
    skipDuplicates: true,
  });
});

test("Manuelle Aufträge beenden die Wartezeit innerhalb von fünf Sekunden", async () => {
  let now = 0;
  const database = {
    jobImportState: { findUniqueOrThrow: async () => ({ requested: now >= 5000 }) },
  };
  await waitForNextImport(database, 0, async (delay) => { now += delay; }, () => now);
  assert.equal(now, 5000);
});

test("Ohne Auftrag bleibt der stündliche Zeitplan erhalten", async () => {
  let now = 0;
  const database = {
    jobImportState: { findUniqueOrThrow: async () => ({ requested: false }) },
  };
  await waitForNextImport(database, 0, async (delay) => {
    assert.ok(delay <= 5000);
    now += delay;
  }, () => now);
  assert.equal(now, 3_600_000);
});

test("Alle drei Seiten nacheinander importieren und Sperre freigeben", async () => {
  const pages = [];
  const queries = [];
  const lockClient = {
    async query(sql) {
      queries.push(sql);
      return { rows: [{ locked: true }] };
    },
  };
  const result = await importJobs(databaseStub(), lockClient, async (url) => {
    const page = Number(url.searchParams.get("page"));
    pages.push(page);
    return fixture(page, 55, [page]);
  });
  assert.deepEqual(pages, [
    1,
    2,
    3,
  ]);
  assert.equal(result.inserted, 3);
  assert.match(queries.at(-1), /pg_advisory_unlock/);
  assert.equal(queries.length, 2);
});

test("Parallelen Import überspringen und Sperre auch nach Parserfehler freigeben", async () => {
  let unlocked = false;
  const busy = { query: async () => ({ rows: [{ locked: false }] }) };
  assert.deepEqual(await importJobs({}, busy), { skipped: true });

  const lockClient = {
    async query(sql) {
      if (sql.includes("pg_advisory_unlock")) unlocked = true;
      return { rows: [{ locked: true }] };
    },
  };
  await assert.rejects(importJobs(databaseStub(), lockClient, async () => "ungültig"));
  assert.equal(unlocked, true);
});

test("Retry-After als Sekunden oder Datum und exponentielle Wartezeit", () => {
  assert.equal(retryDelay("120", 0), 120_000);
  assert.equal(retryDelay("Sun, 15 Nov 2026 12:02:00 GMT", 0, Date.parse("2026-11-15T12:00:00Z")), 120_000);
  assert.equal(retryDelay(null, 2), 240_000);
});
