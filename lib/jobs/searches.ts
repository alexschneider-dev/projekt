import { prisma } from "@/lib/prisma";
import type { UpdateJobSearchValues } from "@/lib/schemas/jobs/jobs.schema";


const select = {
  id: true,
  title: true,
  url: true,
  active: true,
  lastResultCount: true,
  lastFetchedAt: true,
  lastScannedPages: true,
  lastTotalPages: true,
  lastScannedCount: true,
  lastScanComplete: true,
} as const;

function serializeSearch(search: Awaited<ReturnType<typeof findSearch>>) {
  return search ? {
    ...search,
    lastFetchedAt: search.lastFetchedAt?.toISOString() ?? null,
  } : null;
}

function findSearch(userId: string, id: number) {
  return prisma.jobSearch.findUnique({
    where: {
      id,
      userId,
    },
    select,
  });
}

export async function getJobSearch(userId: string, id: number) {
  return serializeSearch(await findSearch(userId, id));
}

export async function updateJobSearch(userId: string, id: number, values: UpdateJobSearchValues) {
  return prisma.$transaction(async (database) => {
    const previous = await database.jobSearch.findUniqueOrThrow({
      where: {
        id,
        userId,
      },
    });
    const search = await database.jobSearch.update({
      where: {
        id,
        userId,
      },
      data: {
        ...values,
        ...("url" in values && previous.url !== values.url ? {
          lastResultCount: null,
          lastFetchedAt: null,
          lastScannedPages: null,
          lastTotalPages: null,
          lastScannedCount: null,
          lastScanComplete: null,
        } : {}),
      },
      select,
    });
    return serializeSearch(search)!;
  });
}

export async function listJobSearches(userId: string) {
  const searches = await prisma.jobSearch.findMany({
    where: { userId },
    select,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });
  return searches.map((search) => serializeSearch(search)!);
}
