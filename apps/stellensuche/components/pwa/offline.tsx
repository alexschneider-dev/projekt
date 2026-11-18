import { Button } from "@/components/ui/button";
import PageWrapper from "@/components/ui/page/page-wrapper";
import { Text } from "@/components/ui/text";
import { ROUTES } from "@/lib/constants/routes";


export function Offline() {
  return (
    <PageWrapper variant="centered">
      <h1>Keine Verbindung</h1>
      <Text variant="description">
        Projekt ist gerade nicht erreichbar. Prüfe deine Internetverbindung und versuche es erneut.
      </Text>
      <Text variant="meta">
        Für die Anmeldung und den Zugriff auf deine Daten benötigst du eine Internetverbindung.
      </Text>
      <form action={ROUTES.home}>
        <Button type="submit">
          Erneut versuchen
        </Button>
      </form>
    </PageWrapper>
  );
}
