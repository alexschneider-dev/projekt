import { setTimeout as sleep } from "node:timers/promises";
import {
  JOB_ERRORS,
  JOB_STOPPED_CODE,
} from "./errors/index.mjs";
import { jobErrorLog } from "./errors/log.mjs";
import { loadSearches } from "./searches.mjs";
import { createImportControl } from "./control.mjs";
import {
  withUserLock,
  remainingJobCapacity
} from "./limits.mjs";
import { claimScheduledImport } from "./schedule.mjs";
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

export async function fetchPage(url, wait = sleep, stopSignal) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    stopSignal?.throwIfAborted();
    await wait(5000 + Math.floor(Math.random() * 5001), undefined, { signal: stopSignal });
    const timeoutSignal = AbortSignal.timeout(60_000);
    const signal = stopSignal ? AbortSignal.any([
      timeoutSignal,
      stopSignal
    ]) : timeoutSignal;
    let response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal,
        headers: { Accept: "text/html" },
      });
      // Auch das vollständige Lesen der Antwort unterliegt dem Zeitlimit.
      if (response.ok) return await response.text();
    } catch (error) {
      stopSignal?.throwIfAborted();
      if (!signal.aborted && error?.name !== "TimeoutError") throw error;

      // Bei Zeitüberschreitungen keine weiteren Abrufe dieser Suchgruppe versuchen.
      throw Object.assign(new Error(JOB_ERRORS.timeout, { cause: error }), { name: "TimeoutError" });
    }

    await response.body?.cancel();
    const fail = (message) => Object.assign(new Error(message), { httpStatus: response.status });
    if (response.status >= 300 && response.status < 400) throw fail(JOB_ERRORS.redirect);
    if (response.status === HTTP_STATUS.FORBIDDEN) throw fail(JOB_ERRORS.blocked);
    const retryable = response.status === HTTP_STATUS.TOO_MANY_REQUESTS
      || response.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR;
    if (!retryable || attempt === 2) throw fail(JOB_ERRORS.response);

    const delay = retryDelay(response.headers.get("retry-after"), attempt);

    // Lange Retry-After-Werte in sichere Timer-Abschnitte teilen.
    for (let remaining = delay; remaining > 0; remaining -= 60_000) {
      await wait(Math.min(remaining, 60_000), undefined, { signal: stopSignal });
    }
  }
}

export async function saveNewUrls(database, urls, userId) {
  if (!userId) throw new Error(JOB_ERRORS.user);
  if (urls.length === 0) return 0;

  return withUserLock(database, userId, async (transaction, limits) => {
    const existing = await transaction.jobListing.findMany({
      where: {
        userId,
        url: { in: urls }
      },
      select: { url: true },
    });
    const known = new Set(existing.map((row) => row.url));
    const count = Number.isFinite(limits.jobs) ? await transaction.jobListing.count({ where: { userId } }) : 0;
    const available = Math.max(0, limits.jobs - count);
    const fresh = [...new Set(urls)].filter((url) => !known.has(url)).slice(0, available);
    if (fresh.length === 0) return 0;

    const result = await transaction.jobListing.createMany({
      data: fresh.map((url) => ({
        userId,
        url
      })),
      skipDuplicates: true,
    });
    return result.count;
  });
}

async function saveSearchProgress(database, search, userId, progress) {
  // Eine während des Imports geänderte oder deaktivierte Suche nicht überschreiben.
  await database.jobSearch.updateMany({
    where: {
      id: search.id,
      userId,
      url: search.url,
      active: true,
    },
    data: {
      ...progress,
      lastFetchedAt: new Date(),
    },
  });
}

export async function importJobs(database, lockClient, loadPage = fetchPage, userId, scheduledAt) {
  if (!userId) throw new Error(JOB_ERRORS.user);

  const lock = await lockClient.query("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_ID]);
  if (!lock.rows[0].locked) return { skipped: true };

  let started = false;
  let inserted = 0;
  let succeeded = false;
  let stopped = false;
  let control;
  let failedSearches = 0;
  let context = {
    phase: "Startstatus speichern",
    userId,
  };
  try {
    if (scheduledAt && !await claimScheduledImport(database, userId, scheduledAt)) return { skipped: true };
    started = true;
    await database.jobImportState.upsert({
      create: {
        userId,
        requested: false,
        running: true,
        stopped: false,
        startedAt: new Date(),
      },
      where: { userId },
      update: {
        requested: false,
        running: true,
        stopped: false,
        startedAt: new Date(),
      },
    });
    control = createImportControl(database, userId);
    await control.check();
    context = {
      phase: "Suchgruppen laden",
      userId,
    };
    const searches = await loadSearches(database, userId);
    searchesLoop: for (const search of searches) {
      if (await remainingJobCapacity(database, userId) === 0) {
        console.log(JSON.stringify({
          message: "Stellenlimit erreicht. Kein weiterer Abruf erforderlich.",
          userId
        }));
        break;
      }
      console.log(JSON.stringify({
        message: "Suchgruppe gestartet.",
        userId,
        searchTitle: search.title,
      }));
      let totalPages = null;
      let total = null;
      let scannedPages = 0;
      const seen = new Set();
      for (let page = 1; page <= (totalPages ?? 1); page += 1) {
        const url = new URL(search.requestUrl);
        url.searchParams.set("page", String(page));
        context = {
          phase: "Suchseite abrufen",
          userId,
          searchTitle: search.title,
          page,
        };
        let html;
        try {
          await control.check();
          html = await loadPage(url, undefined, control.signal);
          control.signal.throwIfAborted();
        } catch (error) {
          if (control.signal.aborted) error = control.signal.reason;
          if (error?.name !== "TimeoutError" && error?.code !== JOB_STOPPED_CODE) throw error;

          context.phase = "Teilstand speichern";
          await saveSearchProgress(database, search, userId, {
            lastResultCount: total,
            lastTotalPages: totalPages,
            lastScannedPages: scannedPages,
            lastScannedCount: seen.size,
            lastScanComplete: false,
          });
          context.phase = "Suchseite abrufen";
          if (error?.code === JOB_STOPPED_CODE) throw error;
          failedSearches += 1;
          console.error(jobErrorLog(error, {
            ...context,
            nextSearch: true,
            scannedPages,
            totalPages,
            scannedCount: seen.size,
            total,
          }));
          continue searchesLoop;
        }
        context.phase = "Suchseite auswerten";
        const result = parseSearchPage(html, page);
        if (page === 1) {
          totalPages = Math.max(1, result.totalPages);
          total = result.total;
        }
        if (totalPages > 1000) throw new Error(JOB_ERRORS.metadata);
        if (result.urls.length > 0 && result.urls.every((entry) => seen.has(entry))) {
          throw new Error(JOB_ERRORS.pagination);
        }

        context.phase = "Stellen speichern";
        inserted += await saveNewUrls(database, result.urls, userId);
        result.urls.forEach((entry) => seen.add(entry));
        scannedPages += 1;
        if (await remainingJobCapacity(database, userId) === 0) break;
      }

      context.phase = "Abrufstand speichern";
      await saveSearchProgress(database, search, userId, {
        lastResultCount: total,
        lastTotalPages: totalPages,
        lastScannedPages: scannedPages,
        lastScannedCount: seen.size,
        lastScanComplete: scannedPages === totalPages,
      });
      console.log(JSON.stringify({
        message: "Suchgruppe abgeschlossen.",
        userId,
        searchTitle: search.title,
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

    await control.check();
    succeeded = true;
    return {
      skipped: false,
      inserted,
    };
  } catch (error) {
    if (error?.name === "AbortError" && control?.signal.aborted) error = control.signal.reason;
    if (error?.code === JOB_STOPPED_CODE) {
      stopped = true;
      console.log(jobErrorLog(error, context));
      return {
        skipped: false,
        stopped: true,
        inserted,
      };
    }
    // Den ursprünglichen Fehler festhalten, auch wenn das Speichern des Fehlerstatus anschließend scheitert.
    console.error(jobErrorLog(error, context));
    throw error;
  } finally {
    await control?.close();
    try {
      if (started) await database.jobImportState.update({
        where: { userId },
        data: {
          running: false,
          stopRequested: false,
          stopped,
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
