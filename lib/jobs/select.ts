import type { Prisma } from "@prisma/client";


export const JOB_LINK_SELECT = {
  id: true,
  url: true,
  isMarkiert: true,
} satisfies Prisma.JobListingSelect;
