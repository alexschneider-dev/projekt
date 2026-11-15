"use client";

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
    isMarkiert: searchParams.get("isMarkiert") ?? undefined,
  });
  const page = parsed.success ? parsed.data.page : 1;
  const isMarkiert = parsed.success ? parsed.data.isMarkiert : undefined;

  function setPage(nextPage: number, replace = false) {
    const query = createJobsQueryString(searchParams.toString(), nextPage, isMarkiert);
    const href = createQueryHref(pathname, query);
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  function setIsMarkiert(value?: boolean) {
    const query = createJobsQueryString(searchParams.toString(), 1, value);
    router.push(createQueryHref(pathname, query), { scroll: false });
  }

  return {
    page,
    setPage,
    isMarkiert,
    setIsMarkiert,
    valid: parsed.success,
  };
}
