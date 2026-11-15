import { prisma } from "@/lib/prisma";
import { parseJobCsv } from "./csv";


export async function markJobsFromCsv(content: string) {
  const {
    urls,
    duplicates,
  } = parseJobCsv(content);

  return prisma.$transaction(async (database) => {
    const existing = await database.jobListing.findMany({
      where: { url: { in: urls } },
      select: { id: true },
    });
    const updated = await database.jobListing.updateMany({
      where: {
        id: { in: existing.map((job) => job.id) },
        isMarkiert: false,
      },
      data: { isMarkiert: true },
    });

    return {
      marked: updated.count,
      alreadyMarked: existing.length - updated.count,
      notFound: urls.length - existing.length,
      duplicates,
    };
  });
}
