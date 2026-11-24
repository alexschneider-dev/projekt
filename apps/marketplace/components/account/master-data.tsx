import {
  dictionaries,
  type Dictionary
} from "@/lib/catalog/dictionaries";
import { AppLink } from "@/components/ui/app-link";
import { Navigation } from "@/components/ui/navigation";
import { Text } from "@/components/ui/text";
import SectionWrapper from "@/components/ui/page/section-wrapper";


export function MasterData() {
  return (
    <SectionWrapper className="mt-10 space-y-4">
      <h2>Stammdaten für Stühle</h2>
      <Text variant="description">
        Verwalte die gemeinsame Auswahl für alle Verkäufer.
      </Text>
      <Navigation
        aria-label="Stammdatenverwaltung"
        className="justify-start"
      >
        {(Object.keys(dictionaries) as Dictionary[]).map((dictionary) => (
          <AppLink
            key={dictionary}
            href={dictionaries[dictionary].href}
          >
            {dictionaries[dictionary].label}
          </AppLink>
        ))}
      </Navigation>
    </SectionWrapper>
  );
}
