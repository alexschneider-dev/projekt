"use client";

import { QueryProvider } from "@/components/ui/query-provider";
import { Text } from "@/components/ui/text";
import { FieldError } from "@/components/ui/field";
import SectionWrapper from "@/components/ui/page/section-wrapper";
import { useJobImport } from "@/hooks/jobs/use-job-import";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";
import { JobScheduleForm } from "./job-schedule-form";


function JobScheduleContent() {
  const { query } = useJobImport();
  const state = query.data;

  return (
    <SectionWrapper className="mt-8 max-w-lg space-y-4">
      {query.isPending ? (
        <Text role="status">Suchzeit wird geladen …</Text>
      ) : query.isError ? (
        <FieldError>{ERROR_JOBS.IMPORT_STATUS_FAILED.message}</FieldError>
      ) : state && (
        <>
          <JobScheduleForm
            key={state.scheduleTime ?? "disabled"}
            scheduleTime={state.scheduleTime}
          />
          <Text variant="meta">
            {state.nextScheduledAt
              ? `Nächste automatische Suche: ${new Date(state.nextScheduledAt).toLocaleString("de-DE", {
                timeZone: "Europe/Berlin",
                dateStyle: "medium",
                timeStyle: "short",
              })} Uhr (Europe/Berlin). Bei laufenden Aufträgen kann sich der Start verzögern.`
              : "Automatische Suche deaktiviert – keine Uhrzeit gespeichert."}
          </Text>
        </>
      )}
    </SectionWrapper>
  );
}

export function JobSchedule() {
  return <QueryProvider><JobScheduleContent /></QueryProvider>;
}
