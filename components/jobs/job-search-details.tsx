import SectionWrapper from "@/components/ui/page/section-wrapper";
import { QueryProvider } from "@/components/ui/query-provider";
import { Text } from "@/components/ui/text";
import { AppLink } from "@/components/ui/app-link";
import { ROUTES } from "@/lib/constants/routes";
import type { JobSearchesResult } from "@/lib/types/jobs";
import { JobSearchForm } from "./job-search-form";
import { SearchLastResult } from "./search-last-result";


export function JobSearchDetails({ search }: { search: JobSearchesResult[number] }) {
  return (
    <SectionWrapper>
      <h1>Suche verwalten</h1>
      <Text variant="intro">
        Titel und Such-URL bearbeiten. Bei einer anderen URL wird die Trefferzahl beim nächsten Import neu ermittelt.
      </Text>
      <div className="space-y-8">
        <AppLink href={ROUTES.jobSearches}>Zurück zu den Such-URLs</AppLink>
        <QueryProvider>
          <JobSearchForm search={search} />
        </QueryProvider>
        <div className="space-y-2">
          <h2>Letzter erfolgreicher Abruf</h2>
          <SearchLastResult search={search} />
        </div>
      </div>
    </SectionWrapper>
  );
}
