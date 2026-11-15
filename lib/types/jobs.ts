import type { Prisma } from "@prisma/client";
import type { JOB_LINK_SELECT } from "@/lib/jobs/select";
import type { listJobSearches } from "@/lib/jobs/searches";


export type JobLink = Prisma.JobListingGetPayload<{ select: typeof JOB_LINK_SELECT }>;

export type JobSearchesResult = Awaited<ReturnType<typeof listJobSearches>>;

export type JobsPageResult = {
  items: JobLink[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export type CreateJobSearchResult = {
  created: boolean;
};
