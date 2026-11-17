import { jobSearchUrlSchema } from "../../lib/schemas/jobs/search.mjs";
import {
  createSearch,
  userLimits
} from "./limits.mjs";
import { JOB_ERRORS } from "./errors/index.mjs";


export function validateSearchUrl(value) {
  const result = jobSearchUrlSchema.safeParse(value);
  if (!result.success) throw new Error(JOB_ERRORS.configuration);

  return result.data;
}

export async function loadSearchUrls(database, userId) {
  return [...new Set((await loadSearches(database, userId)).map((search) => search.requestUrl))];
}

export async function loadSearches(database, userId) {
  if (!userId) throw new Error(JOB_ERRORS.user);

  const limits = await userLimits(database, userId);
  const searches = await database.jobSearch.findMany({
    ...(Number.isFinite(limits.searches) ? { take: limits.searches } : {}),
    where: {
      userId,
      active: true,
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      url: true,
    },
  });
  return searches.map((search) => ({
    ...search,
    requestUrl: validateSearchUrl(search.url),
  }));
}

export async function addSearchUrl(database, value, userId) {
  if (!userId) throw new Error(JOB_ERRORS.user);

  const url = validateSearchUrl(value);
  return createSearch(database, { url }, userId);
}
