"use client";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { FieldError } from "@/components/ui/field";
import { useJobImport } from "@/hooks/jobs/use-job-import";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";


export function JobImportControl() {
  const {
    query,
    mutation,
    stopMutation,
  } = useJobImport();
  const state = query.data;
  const busy = mutation.isPending || state?.requested || state?.running;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => mutation.mutate()}
          disabled={query.isPending || query.isError || busy}
        >
          {state?.running ? "Suche läuft …" : state?.requested ? "Suche angefordert …" : "Alle Suchgruppen jetzt durchsuchen"}
        </Button>
        {state?.running && (
          <Button
            variant="outline"
            disabled={stopMutation.isPending || state.stopRequested}
            onClick={() => stopMutation.mutate()}
          >
            {stopMutation.isPending || state.stopRequested ? "Wird gestoppt …" : "Suche stoppen"}
          </Button>
        )}
      </div>
      <Text
        role="status"
        variant="meta"
      >
        {state?.stopRequested
          ? "Der Importdienst beendet den laufenden Durchlauf. Bereits gespeicherte Stellen bleiben erhalten."
          : state?.running
            ? "Alle aktiven Suchgruppen werden nacheinander mit Pausen durchsucht."
            : state?.requested
              ? "Angefordert – der Importdienst übernimmt den Auftrag, sobald er bereit ist."
              : state?.stopped
                ? `Suche gestoppt. ${state.inserted} neue Stellen wurden bis dahin gespeichert.`
                : state?.finishedAt && state.succeeded
                  ? `Letzter Durchlauf abgeschlossen: ${state.inserted} neue Stellen.`
                  : "Hier kannst du unabhängig von deiner täglichen Suchzeit einen Durchlauf anfordern."}
      </Text>
      {!busy && !state?.stopped && state?.succeeded === false && <FieldError>{ERROR_JOBS.IMPORT_FAILED.message}</FieldError>}
      {query.isError && <FieldError>{ERROR_JOBS.IMPORT_STATUS_FAILED.message}</FieldError>}
    </div>
  );
}
