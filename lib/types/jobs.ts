import type { Prisma } from "@prisma/client";
import type { JOB_LINK_SELECT } from "@/lib/jobs/select";
import type { listJobSearches } from "@/lib/jobs/searches";
import type { markJobsFromCsv } from "@/lib/jobs/mark-csv";
import type {
  getJobImportState,
  requestJobImport,
} from "@/lib/jobs/import-state";


export type JobLink = Prisma.JobListingGetPayload<{ select: typeof JOB_LINK_SELECT }>;

export type JobSearchesResult = Awaited<ReturnType<typeof listJobSearches>>;
export type MarkJobsCsvResult = Awaited<ReturnType<typeof markJobsFromCsv>>;
export type JobImportStateResult = Awaited<ReturnType<typeof getJobImportState>>;
export type RequestJobImportResult = Awaited<ReturnType<typeof requestJobImport>>;

export type JobsPageResult = {
  items: JobLink[];
  page: number;
  pageSize: number;
  total: number;
  unmarkedTotal: number;
  pageCount: number;
};

export type CreateJobSearchResult = {
  created: boolean;
};
