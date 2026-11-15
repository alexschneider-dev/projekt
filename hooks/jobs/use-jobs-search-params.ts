"use client";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { jobsQuerySchema } from "@/lib/schemas/jobs/jobs.schema";
import {
  createPageQueryString,
  createQueryHref,
} from "@/lib/shared/search-params/query-state";


export function useJobsSearchParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parsed = jobsQuerySchema.safeParse({ page: searchParams.get("page") ?? undefined });
  const page = parsed.success ? parsed.data.page : 1;

  function setPage(nextPage: number, replace = false) {
    const query = createPageQueryString(searchParams.toString(), nextPage);
    const href = createQueryHref(pathname, query);
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  return {
    page,
    setPage,
    valid: parsed.success,
  };
}
