"use client";

import type { JobStatus } from "@prisma/client";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { jobsQuerySchema } from "@/lib/schemas/jobs/jobs.schema";
import {
  createJobsQueryString,
  createQueryHref,
} from "@/lib/shared/search-params/query-state";


export function useJobsSearchParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parsed = jobsQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });
  const page = parsed.success ? parsed.data.page : 1;
  const status = parsed.success ? parsed.data.status : undefined;

  function setPage(nextPage: number, replace = false) {
    const query = createJobsQueryString(searchParams.toString(), nextPage, status);
    const href = createQueryHref(pathname, query);
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  function setStatus(value?: JobStatus) {
    const query = createJobsQueryString(searchParams.toString(), 1, value);
    router.push(createQueryHref(pathname, query), { scroll: false });
  }

  return {
    page,
    setPage,
    status,
    setStatus,
    valid: parsed.success,
  };
}
