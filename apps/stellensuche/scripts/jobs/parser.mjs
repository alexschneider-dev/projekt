import { JOB_ERRORS } from "./errors/index.mjs";


function decodeEntities(value) {
  return value.replace(/&(?:quot|amp|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named = {
      "&quot;": '"',
      "&amp;": "&",
      "&apos;": "'",
      "&lt;": "<",
      "&gt;": ">",
    };
    const normalized = entity.toLowerCase();
    if (named[normalized]) return named[normalized];

    const hex = normalized.startsWith("&#x");
    const code = parseInt(normalized.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

export function normalizeJobUrl(value) {
  const url = new URL(decodeEntities(value), "https://www.stepstone.de");
  if (url.origin !== "https://www.stepstone.de" || !/^\/stellenangebote--.+\.html$/.test(url.pathname)) {
    return null;
  }

  url.search = "";
  url.hash = "";
  return url.href;
}

export function parseSearchPage(html, expectedPage) {
  const decoded = decodeEntities(html);
  const number = (key) => {
    const match = decoded.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`));
    return match ? Number(match[1]) : NaN;
  };
  const page = number("searchResultsDisplayedPageNumber");
  const total = number("searchResultsTotalJobCount");
  const perPage = number("ssaResultsPerPage");
  if (![page, total, perPage].every(Number.isSafeInteger) || page < 1 || total < 0 || perPage < 1) {
    throw new Error(JOB_ERRORS.metadata);
  }
  if (page !== expectedPage) throw new Error(JOB_ERRORS.pagination);

  const urls = new Set();
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const attributes = Object.fromEntries(
      [...match[0].matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
        .map((attribute) => [
          attribute[1],
          attribute[2] ?? attribute[3],
        ])
    );
    if (attributes["data-at"] !== "job-item-title" || !attributes.href) continue;

    const url = normalizeJobUrl(attributes.href);
    if (url) urls.add(url);
  }
  if (total > 0 && urls.size === 0) throw new Error(JOB_ERRORS.links);

  return {
    urls: [...urls],
    totalPages: Math.ceil(total / perPage),
    total,
  };
}
