import { jobSearchUrlSchema } from "../../lib/schemas/jobs/search.mjs";
import { JOB_ERRORS } from "./errors/index.mjs";


export function validateSearchUrl(value) {
  const result = jobSearchUrlSchema.safeParse(value);
  if (!result.success) throw new Error(JOB_ERRORS.configuration);

  return result.data;
}

export async function loadSearchUrls(database) {
  const searches = await database.jobSearch.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
    select: { url: true },
  });
  return [...new Set(searches.map((search) => validateSearchUrl(search.url)))];
}

export async function addSearchUrl(database, value) {
  const url = validateSearchUrl(value);
  const result = await database.jobSearch.createMany({
    data: [{ url }],
    skipDuplicates: true,
  });
  return result.count;
}
