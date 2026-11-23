import PageWrapper from "@/components/ui/page/page-wrapper";
import { AppLink } from "@/components/ui/app-link";
import { ROUTES } from "@/lib/constants/routes";


export default function NotFound() {
  return (
    <PageWrapper>
      <h1>Seite nicht gefunden</h1>
      <AppLink href={ROUTES.home}>Zum Stuhlkatalog</AppLink>
    </PageWrapper>
  );
}
