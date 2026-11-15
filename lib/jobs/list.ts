import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { JOB_LINK_SELECT } from "./select";
import type { JobsPageResult } from "@/lib/types/jobs";


export const JOBS_PAGE_SIZE = 100;

export async function listJobs(requestedPage: number, isMarkiert?: boolean): Promise<JobsPageResult> {
  const where: Prisma.JobListingWhereInput = isMarkiert === undefined ? {} : { isMarkiert };

  return prisma.$transaction(async (database) => {
    const total = await database.jobListing.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE));
    const page = Math.min(requestedPage, pageCount);
    const items = await database.jobListing.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: (page - 1) * JOBS_PAGE_SIZE,
      take: JOBS_PAGE_SIZE,
      select: JOB_LINK_SELECT,
    });

    return {
      items,
      page,
      pageSize: JOBS_PAGE_SIZE,
      total,
      pageCount,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
