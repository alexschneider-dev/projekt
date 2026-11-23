import { AppLink } from "@/components/ui/app-link";
import { Text } from "@/components/ui/text";
import { ROUTES } from "@/lib/constants/routes";


export function SiteFooter() {
  return (
    <footer className="mt-16 border-t px-5 py-8">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-5">
        <Text variant="meta">Marktplatz · Ein Projekt zum Entdecken. Alle Angebote sind Demodaten.</Text>
        <AppLink href={ROUTES.credits}>Bildnachweise</AppLink>
      </div>
    </footer>
  );
}
