import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { importJobs } from "../../scripts/jobs/import.mjs";
import {
  addSearchUrl,
  loadSearchUrls,
} from "../../scripts/jobs/searches.mjs";
import { TEST_DATABASE_URL } from "../support/environment.mjs";


function pageHtml(page, id) {
  return JSON.stringify({
    searchResultsDisplayedPageNumber: page,
    searchResultsTotalJobCount: 55,
    ssaResultsPerPage: 25,
  }) + `<a data-at="job-item-title" href="https://www.stepstone.de/stellenangebote--Test--${id}-inline.html?tracking=1">Stelle</a>`;
}

test("PostgreSQL: Suchliste, Pagination, Duplikate, Reihenfolge und Importsperre", async () => {
  const prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  const rollback = Symbol("Teständerungen zurückrollen");
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  const competitor = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  await competitor.connect();

  try {
    const seeded = await prisma.jobSearch.findMany();
    assert.ok(seeded.some((row) => row.url.includes("nextjs")));
    await prisma.$transaction(async (database) => {
      await database.jobSearch.deleteMany();
      await database.jobListing.deleteMany();
      assert.deepEqual(await importJobs(database, client), {
        skipped: false,
        inserted: 0,
      });

      const search = "https://www.stepstone.de/jobs/test?q=TypeScript";
      assert.equal(await addSearchUrl(database, search), 1);
      assert.equal(await addSearchUrl(database, `${search}&page=2`), 0);
      await assert.rejects(addSearchUrl(database, "https://example.org/jobs/test"));
      await database.jobSearch.create({
        data: {
          url: "https://www.stepstone.de/jobs/inaktiv",
          active: false,
        },
      });
      assert.deepEqual(await loadSearchUrls(database), [search]);

      const pages = [];
      await database.jobImportState.update({
        where: { id: 1 },
        data: { requested: true },
      });
      const loadPage = async (url) => {
        const state = await database.jobImportState.findUniqueOrThrow({ where: { id: 1 } });
        assert.equal(state.running, true);
        assert.equal(state.requested, false);
        const page = Number(url.searchParams.get("page"));
        pages.push(page);
        return pageHtml(page, page);
      };
      assert.equal((await importJobs(database, client, loadPage)).inserted, 3);
      const importState = await database.jobImportState.findUniqueOrThrow({ where: { id: 1 } });
      assert.equal(importState.running, false);
      assert.equal(importState.succeeded, true);
      assert.equal(importState.inserted, 3);
      const recorded = await database.jobSearch.findUniqueOrThrow({ where: { url: search } });
      assert.equal(recorded.lastResultCount, 55);
      assert.ok(recorded.lastFetchedAt instanceof Date);
      const inactive = await database.jobSearch.findUniqueOrThrow({
        where: { url: "https://www.stepstone.de/jobs/inaktiv" },
      });
      assert.equal(inactive.lastResultCount, null);
      assert.deepEqual(pages, [
        1,
        2,
        3,
      ]);
      const original = await database.jobListing.findMany({ orderBy: { id: "asc" } });
      assert.equal((await importJobs(database, client, loadPage)).inserted, 0);
      assert.deepEqual(await database.jobListing.findMany({ orderBy: { id: "asc" } }), original);

      // Ein später hinzugefügter Suchauftrag wird beim nächsten Durchlauf gelesen.
      await addSearchUrl(database, "https://www.stepstone.de/jobs/neu");
      const updated = await importJobs(database, client, async (url) => {
        const page = Number(url.searchParams.get("page"));
        return pageHtml(page, url.pathname.endsWith("/neu") ? page + 10 : page);
      });
      assert.equal(updated.inserted, 3);
      const ordered = await database.jobListing.findMany({
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
      });
      assert.match(ordered[0].url, /--13-inline.html$/);
      assert.equal(ordered.length, 6);

      await client.query("SELECT pg_advisory_lock(74195621)");
      try {
        assert.deepEqual(await importJobs(database, competitor), { skipped: true });
      } finally {
        await client.query("SELECT pg_advisory_unlock(74195621)");
      }

      const beforeFailure = await database.jobSearch.findUniqueOrThrow({ where: { url: search } });
      await assert.rejects(importJobs(database, client, async (url) => {
        return url.searchParams.get("page") === "1" ? pageHtml(1, 1) : "ungültige Antwort";
      }));
      assert.deepEqual(await database.jobSearch.findUniqueOrThrow({ where: { url: search } }), beforeFailure);
      assert.equal((await database.jobImportState.findUniqueOrThrow({ where: { id: 1 } })).succeeded, false);
      await importJobs(database, client, async () => JSON.stringify({
        searchResultsDisplayedPageNumber: 1,
        searchResultsTotalJobCount: 0,
        ssaResultsPerPage: 25,
      }));
      assert.equal((await database.jobSearch.findUniqueOrThrow({ where: { url: search } })).lastResultCount, 0);

      await importJobs(database, client, async (url) => {
        const page = Number(url.searchParams.get("page"));
        if (url.pathname === "/jobs/test" && page === 1) {
          await database.jobSearch.update({
            where: { url: search },
            data: {
              url: `${search}&q2=neu`,
              lastResultCount: null,
              lastFetchedAt: null,
            },
          });
        }
        return pageHtml(page, page);
      });
      assert.equal((await database.jobSearch.findUniqueOrThrow({ where: { id: recorded.id } })).lastResultCount, null);
      const available = await competitor.query("SELECT pg_try_advisory_lock(74195621) AS locked");
      assert.equal(available.rows[0].locked, true);
      await competitor.query("SELECT pg_advisory_unlock(74195621)");
      throw rollback;
    }, { timeout: 30_000 });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
    await client.end();
    await competitor.end();
  }
});
