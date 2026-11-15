import { setTimeout as sleep } from "node:timers/promises";
import { JOB_ERRORS } from "./errors/index.mjs";
import { loadSearches } from "./searches.mjs";
import { parseSearchPage } from "./parser.mjs";


const HTTP_STATUS = {
  FORBIDDEN: 403,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};
const LOCK_ID = 74195621;

export function retryDelay(value, attempt, now = Date.now()) {
  if (value !== null) {
    const seconds = Number(value);
    const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
    if (Number.isFinite(milliseconds)) return Math.max(5000, milliseconds);
  }

  return 60_000 * 2 ** attempt;
}

export async function fetchPage(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await sleep(5000 + Math.floor(Math.random() * 5001));
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: "text/html" },
    });
    if (response.ok) return response.text();

    await response.body?.cancel();
    if (response.status === HTTP_STATUS.FORBIDDEN) throw new Error(JOB_ERRORS.blocked);
    const retryable = response.status === HTTP_STATUS.TOO_MANY_REQUESTS
      || response.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR;
    if (!retryable || attempt === 2) throw new Error(JOB_ERRORS.response);

    const delay = retryDelay(response.headers.get("retry-after"), attempt);
    // Lange Retry-After-Werte in sichere Timer-Abschnitte teilen.
    for (let remaining = delay; remaining > 0; remaining -= 60_000) {
      await sleep(Math.min(remaining, 60_000));
    }
  }
}

export async function saveNewUrls(database, urls) {
  if (urls.length === 0) return 0;

  const existing = await database.jobListing.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });
  const known = new Set(existing.map((row) => row.url));
  const fresh = [...new Set(urls)].filter((url) => !known.has(url));
  if (fresh.length === 0) return 0;

  const result = await database.jobListing.createMany({
    data: fresh.map((url) => ({ url })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function importJobs(database, lockClient, loadPage = fetchPage) {
  const lock = await lockClient.query("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_ID]);
  if (!lock.rows[0].locked) return { skipped: true };

  let inserted = 0;
  let succeeded = false;
  try {
    await database.jobImportState.update({
      where: { id: 1 },
      data: {
        requested: false,
        running: true,
        startedAt: new Date(),
      },
    });
    const searches = await loadSearches(database);
    for (const search of searches) {
      let totalPages = 1;
      let total = 0;
      const seen = new Set();
      for (let page = 1; page <= totalPages; page += 1) {
        const url = new URL(search.requestUrl);
        url.searchParams.set("page", String(page));
        const result = parseSearchPage(await loadPage(url), page);
        if (page === 1) {
          totalPages = result.totalPages;
          total = result.total;
        }
        if (totalPages > 1000) throw new Error(JOB_ERRORS.metadata);
        if (result.urls.length > 0 && result.urls.every((entry) => seen.has(entry))) {
          throw new Error(JOB_ERRORS.pagination);
        }

        inserted += await saveNewUrls(database, result.urls);
        result.urls.forEach((entry) => seen.add(entry));
      }

      // Nur vollständige Abrufe speichern; eine inzwischen geänderte Suche nicht überschreiben.
      await database.jobSearch.updateMany({
        where: {
          id: search.id,
          url: search.url,
          active: true,
        },
        data: {
          lastResultCount: total,
          lastFetchedAt: new Date(),
        },
      });
    }

    succeeded = true;
    return {
      skipped: false,
      inserted,
    };
  } finally {
    try {
      await database.jobImportState.update({
        where: { id: 1 },
        data: {
          running: false,
          finishedAt: new Date(),
          succeeded,
          inserted,
        },
      });
    } finally {
      await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
    }
  }
}
