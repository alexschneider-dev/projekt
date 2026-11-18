import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseJobCsv } from "./csv";


export async function applyJobsFromCsv(userId: string, content: string) {
  const {
    urls,
    duplicates,
  } = parseJobCsv(content);

  return prisma.$transaction(async (database) => {
    const existing = await database.jobListing.findMany({
      where: {
        userId,
        url: { in: urls },
      },
      select: { id: true },
    });
    const updated = await database.jobListing.updateMany({
      where: {
        userId,
        id: { in: existing.map((job) => job.id) },
        status: { not: JobStatus.BEWORBEN },
      },
      data: { status: JobStatus.BEWORBEN },
    });

    return {
      applied: updated.count,
      alreadyApplied: existing.length - updated.count,
      notFound: urls.length - existing.length,
      duplicates,
    };
  });
}
