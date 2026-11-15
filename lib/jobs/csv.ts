import { normalizeJobUrl } from "@/scripts/jobs/parser.mjs";
import { createApiError } from "@/lib/http/errors";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";
import { JOB_CSV_MAX_LINKS } from "@/lib/schemas/jobs/csv.schema";


export function parseJobCsv(content: string) {
  const urls: string[] = [];
  const rows = content.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/).filter((line) => line.trim());
  if (rows.length > JOB_CSV_MAX_LINKS + 1) throw createApiError(ERROR_JOBS.CSV_LIMIT);

  for (const [index, row] of rows.entries()) {
    let value = row.trim();
    // Einspaltige CSV: Anführungszeichen und darin verdoppelte Zeichen unterstützen.
    if (value.startsWith('"')) {
      if (!/^"(?:[^"\r\n]|"")*"$/.test(value)) throw createApiError(ERROR_JOBS.CSV_CONTENT);
      value = value.slice(1, -1).replaceAll('""', '"').trim();
    } else if (/[",;]/.test(value)) {
      throw createApiError(ERROR_JOBS.CSV_CONTENT);
    }
    if (index === 0 && /^(url|link|stellenlink)$/i.test(value)) continue;

    let url: string | null = null;
    try {
      const parsed = new URL(value);
      const isHttp = parsed.protocol === "https:" || parsed.protocol === "http:";
      if (isHttp && !parsed.username && !parsed.password && !/\s/.test(value)) {
        url = normalizeJobUrl(value) ?? parsed.href;
      }
    } catch {
      // Ungültige URLs erhalten dieselbe verständliche Meldung wie andere CSV-Fehler.
    }
    if (!url) throw createApiError(ERROR_JOBS.CSV_CONTENT);
    urls.push(url);
  }

  if (urls.length > JOB_CSV_MAX_LINKS) throw createApiError(ERROR_JOBS.CSV_LIMIT);
  if (!urls.length) throw createApiError(ERROR_JOBS.CSV_CONTENT);

  const unique = [...new Set(urls)];
  return {
    urls: unique,
    duplicates: urls.length - unique.length,
  };
}
