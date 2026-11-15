import { Text } from "@/components/ui/text";
import type { JobSearchesResult } from "@/lib/types/jobs";


export function SearchLastResult({ search }: { search: JobSearchesResult[number] }) {
  const hasProgress = search.lastScannedCount !== null;
  const result = hasProgress
    ? `${search.lastScannedCount} von ${search.lastResultCount ?? "unbekannt"} Treffern erfasst`
    : search.lastResultCount === null ? "Noch nicht abgerufen" : `${search.lastResultCount} Treffer`;

  return (
    <div className="space-y-1">
      <Text>{result}</Text>
      {search.lastScannedPages !== null && (
        <Text variant="meta">
          {search.lastScannedPages} von {search.lastTotalPages ?? "unbekannt"} Seiten erfasst
        </Text>
      )}
      {search.lastScanComplete !== null && (
        <Text variant="meta">
          {search.lastScanComplete ? "Vollständig" : "Unvollständig"}
        </Text>
      )}
      {search.lastFetchedAt && (
        <Text variant="meta">
          <time dateTime={search.lastFetchedAt}>
            {new Intl.DateTimeFormat("de-DE", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "Europe/Berlin",
            }).format(new Date(search.lastFetchedAt))}
          </time>
        </Text>
      )}
    </div>
  );
}
