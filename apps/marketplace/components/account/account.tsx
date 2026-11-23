import type { InternalRole } from "@/lib/auth/roles";
import {
  hasRole,
  roleLabels,
  SELLER,
  SUPER_ADMIN
} from "@/lib/auth/roles";
import { ROUTES } from "@/lib/constants/routes";
import { AppLink } from "@/components/ui/app-link";
import { Text } from "@/components/ui/text";
import { Navigation } from "@/components/ui/navigation";
import PageWrapper from "@/components/ui/page/page-wrapper";


export function Account({
  email,
  role
}: {
  email: string;
  role: InternalRole
}) {
  return (
    <PageWrapper>
      <h1>Mein Konto</h1>
      <Text variant="description">
        {email} · {roleLabels[role]}
      </Text>
      <Navigation
        aria-label="Kontobereiche"
        className="mt-8 justify-start"
      >
        <AppLink href={ROUTES.home}>Stühle entdecken</AppLink>
        {hasRole(role, SELLER) && <AppLink href={ROUTES.seller}>Meine Angebote</AppLink>}
        {hasRole(role, SUPER_ADMIN) && <AppLink href={ROUTES.superAdmin}>Verwaltung</AppLink>}
      </Navigation>
    </PageWrapper>
  );
}
