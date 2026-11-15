import { prisma } from "@/lib/prisma";
import type { JobSearchValues } from "@/lib/schemas/jobs/jobs.schema";


const select = {
  id: true,
  title: true,
  url: true,
  active: true,
  lastResultCount: true,
  lastFetchedAt: true,
} as const;

function serializeSearch(search: Awaited<ReturnType<typeof findSearch>>) {
  return search ? {
    ...search,
    lastFetchedAt: search.lastFetchedAt?.toISOString() ?? null,
  } : null;
}

function findSearch(id: number) {
  return prisma.jobSearch.findUnique({
    where: { id },
    select,
  });
}

export async function getJobSearch(id: number) {
  return serializeSearch(await findSearch(id));
}

export async function updateJobSearch(id: number, values: JobSearchValues) {
  return prisma.$transaction(async (database) => {
    const previous = await database.jobSearch.findUniqueOrThrow({ where: { id } });
    const search = await database.jobSearch.update({
      where: { id },
      data: {
        ...values,
        ...(previous.url !== values.url ? {
          lastResultCount: null,
          lastFetchedAt: null,
        } : {}),
      },
      select,
    });
    return serializeSearch(search)!;
  });
}

export async function listJobSearches() {
  const searches = await prisma.jobSearch.findMany({
    select,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });
  return searches.map((search) => serializeSearch(search)!);
}
