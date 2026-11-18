import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import {
  loadImportUsers,
  claimScheduledImport,
} from "../../scripts/jobs/schedule.mjs";
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
      const { id: userId } = await database.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "",
          name: "Importtest",
          role: "SUPER_ADMIN"
        }
      });
      await database.jobSearch.deleteMany();
      await database.jobListing.deleteMany();
      assert.deepEqual(await importJobs(database, client, undefined, userId), {
        skipped: false,
        inserted: 0,
      });

      const search = "https://www.stepstone.de/jobs/test?q=TypeScript";
      assert.equal(await addSearchUrl(database, search, userId), 1);
      assert.equal(await addSearchUrl(database, `${search}&page=2`, userId), 0);
      await assert.rejects(addSearchUrl(database, "https://example.org/jobs/test", userId));
      await database.jobSearch.create({
        data: {
          userId,
          url: "https://www.stepstone.de/jobs/inaktiv",
          active: false,
        },
      });
      assert.deepEqual(await loadSearchUrls(database, userId), [search]);

      const pages = [];
      await database.jobImportState.update({
        where: { userId },
        data: { requested: true },
      });
      const loadPage = async (url) => {
        const state = await database.jobImportState.findUniqueOrThrow({ where: { userId } });
        assert.equal(state.running, true);
        assert.equal(state.requested, false);
        const page = Number(url.searchParams.get("page"));
        pages.push(page);
        return pageHtml(page, page);
      };
      assert.equal((await importJobs(database, client, loadPage, userId)).inserted, 3);
      const importState = await database.jobImportState.findUniqueOrThrow({ where: { userId } });
      assert.equal(importState.running, false);
      assert.equal(importState.succeeded, true);
      assert.equal(importState.inserted, 3);
      const recorded = await database.jobSearch.findUniqueOrThrow({
        where: {
          userId_url: {
            userId,
            url: search
          }
        }
      });
      assert.equal(recorded.lastResultCount, 55);
      assert.equal(recorded.lastScannedPages, 3);
      assert.equal(recorded.lastTotalPages, 3);
      assert.equal(recorded.lastScannedCount, 3);
      assert.equal(recorded.lastScanComplete, true);
      assert.ok(recorded.lastFetchedAt instanceof Date);
      const inactive = await database.jobSearch.findUniqueOrThrow({
        where: {
          userId_url: {
            userId,
            url: "https://www.stepstone.de/jobs/inaktiv"
          }
        },
      });
      assert.equal(inactive.lastResultCount, null);
      assert.deepEqual(pages, [
        1,
        2,
        3,
      ]);
      const original = await database.jobListing.findMany({ orderBy: { id: "asc" } });
      assert.equal((await importJobs(database, client, loadPage, userId)).inserted, 0);
      assert.deepEqual(await database.jobListing.findMany({ orderBy: { id: "asc" } }), original);

      // Ein später hinzugefügter Suchauftrag wird beim nächsten Durchlauf gelesen.
      await addSearchUrl(database, "https://www.stepstone.de/jobs/neu", userId);
      const updated = await importJobs(database, client, async (url) => {
        const page = Number(url.searchParams.get("page"));
        return pageHtml(page, url.pathname.endsWith("/neu") ? page + 10 : page);
      }, userId);
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
        assert.deepEqual(await importJobs(database, competitor, undefined, userId), { skipped: true });
      } finally {
        await client.query("SELECT pg_advisory_unlock(74195621)");
      }

      const beforeFailure = await database.jobSearch.findUniqueOrThrow({
        where: {
          userId_url: {
            userId,
            url: search
          }
        }
      });
      await assert.rejects(importJobs(database, client, async (url) => {
        return url.searchParams.get("page") === "1" ? pageHtml(1, 1) : "ungültige Antwort";
      }, userId));
      assert.deepEqual(await database.jobSearch.findUniqueOrThrow({
        where: {
          userId_url: {
            userId,
            url: search
          }
        }
      }), beforeFailure);
      assert.equal((await database.jobImportState.findUniqueOrThrow({ where: { userId } })).succeeded, false);
      await assert.rejects(importJobs(database, client, async (url) => {
        if (url.searchParams.get("page") === "2") throw new DOMException("", "TimeoutError");
        return pageHtml(1, 1);
      }, userId));
      const partial = await database.jobSearch.findUniqueOrThrow({ where: { id: recorded.id } });
      assert.equal(partial.lastResultCount, 55);
      assert.equal(partial.lastTotalPages, 3);
      assert.equal(partial.lastScannedPages, 1);
      assert.equal(partial.lastScannedCount, 1);
      assert.equal(partial.lastScanComplete, false);
      await importJobs(database, client, async () => JSON.stringify({
        searchResultsDisplayedPageNumber: 1,
        searchResultsTotalJobCount: 0,
        ssaResultsPerPage: 25,
      }), userId);
      assert.equal((await database.jobSearch.findUniqueOrThrow({
        where: {
          userId_url: {
            userId,
            url: search
          }
        }
      })).lastResultCount, 0);

      await importJobs(database, client, async (url) => {
        const page = Number(url.searchParams.get("page"));
        if (url.pathname === "/jobs/test" && page === 1) {
          await database.jobSearch.update({
            where: {
              userId_url: {
                userId,
                url: search
              }
            },
            data: {
              url: `${search}&q2=neu`,
              lastResultCount: null,
              lastFetchedAt: null,
            },
          });
        }
        return pageHtml(page, page);
      }, userId);
      assert.equal((await database.jobSearch.findUniqueOrThrow({ where: { id: recorded.id } })).lastResultCount, null);
      const available = await competitor.query("SELECT pg_try_advisory_lock(74195621) AS locked");
      assert.equal(available.rows[0].locked, true);
      await competitor.query("SELECT pg_advisory_unlock(74195621)");
      // Gleiche URLs sind je Benutzer erlaubt; Import und Markierungen bleiben getrennt.
      const other = await database.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "",
          name: "Zweiter Importbenutzer"
        }
      });
      await addSearchUrl(database, search, other.id);
      const firstState = await database.jobImportState.findUniqueOrThrow({ where: { userId } });
      assert.equal((await importJobs(database, client, async (url) => {
        const page = Number(url.searchParams.get("page"));
        return pageHtml(page, page);
      }, other.id)).inserted, 3);
      assert.equal(await database.jobListing.count({ where: { userId: other.id } }), 3);
      assert.deepEqual(await database.jobImportState.findUniqueOrThrow({ where: { userId } }), firstState);
      const own = await database.jobListing.findFirstOrThrow({ where: { userId } });
      await database.jobListing.update({
        where: { id: own.id },
        data: { status: "BEWORBEN" }
      });
      assert.equal(await database.jobListing.count({
        where: {
          userId: other.id,
          status: "BEWORBEN"
        }
      }), 0);
      await database.jobImportState.updateMany({ data: { requested: false } });
      await database.jobImportState.update({
        where: { userId },
        data: { requested: true }
      });
      assert.deepEqual((await loadImportUsers(database)).map(user => user.id), [userId]);
      await database.jobImportState.update({
        where: { userId },
        data: { requested: false },
      });
      assert.deepEqual(await loadImportUsers(database), []);
      const due = new Date("2026-11-17T09:00:00Z");
      await database.jobImportState.update({
        where: { userId },
        data: {
          scheduleTime: "10:00",
          nextScheduledAt: due,
        },
      });
      assert.deepEqual(await loadImportUsers(database, new Date("2026-11-17T08:59:00Z")), []);
      assert.deepEqual((await loadImportUsers(database, due)).map(user => user.id), [userId]);
      assert.equal(await claimScheduledImport(database, userId, due, due), true);
      assert.equal(await claimScheduledImport(database, userId, due, due), false);
      assert.deepEqual(await loadImportUsers(database, due), []);
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
