"use client";

import type { JobStatus } from "@prisma/client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/http/fetch-json";
import {
  ROUTES,
  jobSearchApiHref,
} from "@/lib/constants/routes";
import { useAppMutation } from "@/lib/query/use-app-mutation";
import type {
  JobSearchValues,
  UpdateJobSearchValues,
  UpdateJobStatusInput,
} from "@/lib/schemas/jobs/jobs.schema";
import type {
  CreateJobSearchResult,
  JobsPageResult,
  JobSearchesResult,
  JobLink,
} from "@/lib/types/jobs";
import {
  createJobsQueryString,
  createQueryHref,
} from "@/lib/shared/search-params/query-state";


export function useJobsQuery(page: number, status?: JobStatus) {
  return useQuery({
    queryKey: [
      "jobs",
      page,
      status ?? "all",
    ],
    queryFn: ({ signal }) => fetchJson<JobsPageResult>(
      createQueryHref(ROUTES.jobsApi, createJobsQueryString("", page, status)),
      {
        method: "GET",
        signal,
      }
    ),
  });
}

export function useJobSearchesQuery() {
  return useQuery({
    queryKey: ["job-searches"],
    queryFn: ({ signal }) => fetchJson<JobSearchesResult>(ROUTES.jobSearchesApi, {
      method: "GET",
      signal,
    }),
  });
}

export function useCreateJobSearch() {
  return useAppMutation<CreateJobSearchResult, JobSearchValues>({
    mutationFn: (body) => fetchJson(ROUTES.jobSearchesApi, {
      method: "POST",
      body,
    }),
    invalidateKeys: [["job-searches"]],
  });
}

export function useUpdateJobStatus() {
  return useAppMutation<JobLink, UpdateJobStatusInput>({
    mutationFn: (body) => fetchJson(ROUTES.jobsApi, {
      method: "PATCH",
      body,
    }),
    invalidateKeys: [["jobs"]],
  });
}

export function useUpdateJobSearch() {
  return useAppMutation<JobSearchesResult[number], UpdateJobSearchValues & { id: number }>({
    mutationFn: ({
      id,
      ...body
    }) => fetchJson(jobSearchApiHref(id), {
      method: "PATCH",
      body,
    }),
    invalidateKeys: [["job-searches"]],
  });
}
