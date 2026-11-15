"use client";

import { useEffect } from "react";
import SectionWrapper from "@/components/ui/page/section-wrapper";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { JobsTable } from "./jobs-table";
import { JobsFilter } from "./jobs-filter";
import { useJobsQuery } from "@/hooks/jobs/use-jobs-query";
import { useJobsSearchParams } from "@/hooks/jobs/use-jobs-search-params";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";


export function JobsContent() {
  const {
    page,
    setPage,
    valid,
    isMarkiert,
    setIsMarkiert,
  } = useJobsSearchParams();
  const query = useJobsQuery(page, isMarkiert);

  useEffect(() => {
    if (!valid || (query.data && query.data.page !== page)) {
      setPage(query.data?.page ?? 1, true);
    }
  }, [
    valid,
    query.data,
    page,
    setPage,
  ]);

  return (
    <SectionWrapper>
      <h1>Stellen</h1>
      <Text variant="intro">
        Neueste Funde zuerst. Pro Seite werden bis zu 100 Stellen angezeigt.
      </Text>
      <div className="space-y-8">
        <JobsFilter
          isMarkiert={isMarkiert}
          onChange={setIsMarkiert}
        />
        {query.isPending ? (
          <Text role="status">Stellen werden geladen …</Text>
        ) : query.isError ? (
          <div className="space-y-3">
            <FieldError>{ERROR_JOBS.LOAD_FAILED.message}</FieldError>
            <Button
              variant="outline"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              Erneut versuchen
            </Button>
          </div>
        ) : (
          <JobsTable
            result={query.data}
            onPageChange={setPage}
          />
        )}
      </div>
    </SectionWrapper>
  );
}
