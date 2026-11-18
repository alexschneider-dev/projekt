"use client";

import SectionWrapper from "@/components/ui/page/section-wrapper";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { JobSearchForm } from "./job-search-form";
import { JobImportControl } from "./job-import-control";
import { JobSearchesTable } from "./job-searches-table";
import { useJobSearchesQuery } from "@/hooks/jobs/use-jobs-query";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";


export function JobSearchesContent() {
  const query = useJobSearchesQuery();

  return (
    <SectionWrapper>
      <h1>Such-URLs</h1>
      <Text variant="intro">

        Klicke auf einen Titel, um die Suche zu verwalten. Der letzte Abruf zeigt die erfassten Seiten und Treffer, auch bei einem unvollständigen Import.

      </Text>
      <Text variant="hint">
        Reguläre Konten können eine Suchgruppe und höchstens 100 Stellen speichern. Stellen mit jedem Status zählen mit. Ist das Limit erreicht, pausiert der Abruf neuer Stellen.
      </Text>
      <div className="space-y-8">
        <JobImportControl />
        <JobSearchForm />
        {query.isPending ? (
          <Text role="status">Such-URLs werden geladen …</Text>
        ) : query.isError ? (
          <div className="space-y-3">
            <FieldError>{ERROR_JOBS.SEARCHES_LOAD_FAILED.message}</FieldError>
            <Button
              variant="outline"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              Erneut versuchen
            </Button>
          </div>
        ) : (
          <JobSearchesTable items={query.data} />
        )}
      </div>
    </SectionWrapper>
  );
}
