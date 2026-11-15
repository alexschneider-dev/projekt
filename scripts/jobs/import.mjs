import { setTimeout as sleep } from "node:timers/promises";
import { JOB_ERRORS } from "./errors/index.mjs";
import { jobErrorLog } from "./errors/log.mjs";
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

export async function fetchPage(url, context = {}, wait = sleep) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await wait(5000 + Math.floor(Math.random() * 5001));
    const signal = AbortSignal.timeout(60_000);
    let response;
    let delay;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal,
        headers: { Accept: "text/html" },
      });
      // Auch das vollständige Lesen der Antwort unterliegt dem Zeitlimit.
      if (response.ok) return await response.text();
    } catch (error) {
      if (!signal.aborted && error?.name !== "TimeoutError") throw error;

      const timeout = Object.assign(new Error(JOB_ERRORS.timeout, { cause: error }), { name: "TimeoutError" });
      if (attempt === 2) throw timeout;

      delay = retryDelay(null, attempt);
      console.warn(jobErrorLog(timeout, {
        ...context,
        attempt: attempt + 1,
        retryInMs: delay,
      }));
    }

    if (response && delay === undefined) {
      await response.body?.cancel();
      const fail = (message) => Object.assign(new Error(message), { httpStatus: response.status });
      if (response.status >= 300 && response.status < 400) throw fail(JOB_ERRORS.redirect);
      if (response.status === HTTP_STATUS.FORBIDDEN) throw fail(JOB_ERRORS.blocked);
      const retryable = response.status === HTTP_STATUS.TOO_MANY_REQUESTS
        || response.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR;
      if (!retryable || attempt === 2) throw fail(JOB_ERRORS.response);

      delay = retryDelay(response.headers.get("retry-after"), attempt);
    }

    // Lange Retry-After-Werte in sichere Timer-Abschnitte teilen.
    for (let remaining = delay; remaining > 0; remaining -= 60_000) {
      await wait(Math.min(remaining, 60_000));
    }
  }
}

export async function saveNewUrls(database, urls, userId) {
  if (!userId) throw new Error(JOB_ERRORS.user);
  if (urls.length === 0) return 0;

  const existing = await database.jobListing.findMany({
    where: {
      userId,
      url: { in: urls },
    },
    select: { url: true },
  });
  const known = new Set(existing.map((row) => row.url));
  const fresh = [...new Set(urls)].filter((url) => !known.has(url));
  if (fresh.length === 0) return 0;

  const result = await database.jobListing.createMany({
    data: fresh.map((url) => ({
      userId,
      url,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function importJobs(database, lockClient, loadPage = fetchPage, userId) {
  if (!userId) throw new Error(JOB_ERRORS.user);

  const lock = await lockClient.query("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_ID]);
  if (!lock.rows[0].locked) return { skipped: true };

  let inserted = 0;
  let succeeded = false;
  let failedSearches = 0;
  let context = {
    phase: "Startstatus speichern",
    userId,
  };
  try {
    await database.jobImportState.upsert({
      create: {
        userId,
        requested: false,
        running: true,
        startedAt: new Date(),
      },
      where: { userId },
      update: {
        requested: false,
        running: true,
        startedAt: new Date(),
      },
    });
    context = {
      phase: "Suchgruppen laden",
      userId,
    };
    const searches = await loadSearches(database, userId);
    searchesLoop: for (const search of searches) {
      console.log(JSON.stringify({
        message: "Suchgruppe gestartet.",
        userId,
        searchId: search.id,
      }));
      let totalPages = 1;
      let total = 0;
      const seen = new Set();
      for (let page = 1; page <= totalPages; page += 1) {
        const url = new URL(search.requestUrl);
        url.searchParams.set("page", String(page));
        context = {
          phase: "Suchseite abrufen",
          userId,
          searchId: search.id,
          page,
        };
        let html;
        try {
          html = await loadPage(url, context);
        } catch (error) {
          if (error?.name !== "TimeoutError") throw error;

          failedSearches += 1;
          console.error(jobErrorLog(error, {
            ...context,
            nextSearch: true,
          }));
          continue searchesLoop;
        }
        context.phase = "Suchseite auswerten";
        const result = parseSearchPage(html, page);
        if (page === 1) {
          totalPages = result.totalPages;
          total = result.total;
        }
        if (totalPages > 1000) throw new Error(JOB_ERRORS.metadata);
        if (result.urls.length > 0 && result.urls.every((entry) => seen.has(entry))) {
          throw new Error(JOB_ERRORS.pagination);
        }

        context.phase = "Stellen speichern";
        inserted += await saveNewUrls(database, result.urls, userId);
        result.urls.forEach((entry) => seen.add(entry));
      }

      // Nur vollständige Abrufe speichern; eine inzwischen geänderte Suche nicht überschreiben.
      context.phase = "Trefferzahl speichern";
      await database.jobSearch.updateMany({
        where: {
          id: search.id,
          userId,
          url: search.url,
          active: true,
        },
        data: {
          lastResultCount: total,
          lastFetchedAt: new Date(),
        },
      });
      console.log(JSON.stringify({
        message: "Suchgruppe abgeschlossen.",
        userId,
        searchId: search.id,
        totalPages,
        total,
      }));
    }

    if (failedSearches > 0) {
      context = {
        phase: "Durchlauf abschließen",
        userId,
        failedSearches,
      };
      throw new Error(JOB_ERRORS.partial);
    }

    succeeded = true;
    return {
      skipped: false,
      inserted,
    };
  } catch (error) {
    // Den ursprünglichen Fehler festhalten, auch wenn das Speichern des Fehlerstatus anschließend scheitert.
    console.error(jobErrorLog(error, context));
    throw error;
  } finally {
    try {
      await database.jobImportState.update({
        where: { userId },
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
