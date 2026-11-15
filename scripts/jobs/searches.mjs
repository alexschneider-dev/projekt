import { jobSearchUrlSchema } from "../../lib/schemas/jobs/search.mjs";
import { JOB_ERRORS } from "./errors/index.mjs";


export function validateSearchUrl(value) {
  const result = jobSearchUrlSchema.safeParse(value);
  if (!result.success) throw new Error(JOB_ERRORS.configuration);

  return result.data;
}

export async function loadSearchUrls(database) {
  return [...new Set((await loadSearches(database)).map((search) => search.requestUrl))];
}

export async function loadSearches(database) {
  const searches = await database.jobSearch.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
    select: {
      id: true,
      url: true,
    },
  });
  return searches.map((search) => ({
    ...search,
    requestUrl: validateSearchUrl(search.url),
  }));
}

export async function addSearchUrl(database, value) {
  const url = validateSearchUrl(value);
  const result = await database.jobSearch.createMany({
    data: [{ url }],
    skipDuplicates: true,
  });
  return result.count;
}
