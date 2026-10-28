import PageWrapper from "@/components/ui/page/page-wrapper";
import { AppLink } from "@/components/ui/app-link";
import { Navigation } from "@/components/ui/navigation";
import { ROUTES } from "@/lib/constants/routes";


export function Home() {
  return (
    <PageWrapper variant="centered">
      <h1>Projekt</h1>
      <Navigation aria-label="Seitennavigation">
        <AppLink href={ROUTES.login}>Anmelden</AppLink>
        <AppLink href={ROUTES.dashboard}>
          Interner Bereich
        </AppLink>
      </Navigation>
    </PageWrapper>
  )
}
