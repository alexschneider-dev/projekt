import type { Prisma } from "@prisma/client";


export const JOB_LINK_SELECT = {
  id: true,
  url: true,
  status: true,
} satisfies Prisma.JobListingSelect;
