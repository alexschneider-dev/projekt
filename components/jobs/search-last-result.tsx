import { Text } from "@/components/ui/text";
import type { JobSearchesResult } from "@/lib/types/jobs";


export function SearchLastResult({ search }: { search: JobSearchesResult[number] }) {
  return (
    <div className="space-y-1">
      <Text>{search.lastResultCount === null ? "Noch nicht abgerufen" : `${search.lastResultCount} Treffer`}</Text>
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
