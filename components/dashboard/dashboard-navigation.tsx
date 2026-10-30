import { AppLink } from "@/components/ui/app-link";
import { Navigation } from "@/components/ui/navigation";
import {
  hasRole,
  ADMIN,
  SUPER_ADMIN,
  type InternalRole,
} from "@/lib/auth/roles";
import { ROUTES } from "@/lib/constants/routes";


export function DashboardNavigation({ role }: { role: InternalRole }) {
  return (
    <Navigation
      aria-label="Hauptnavigation"
      variant="dashboard"
    >
      <AppLink
        href={ROUTES.dashboard}
        variant="navigation"
      >
        Übersicht
      </AppLink>
      {hasRole(role, ADMIN) && (
        <AppLink
          href={ROUTES.admin}
          variant="navigation"
        >
          Administration
        </AppLink>
      )}
      {hasRole(role, SUPER_ADMIN) && (
        <AppLink
          href={ROUTES.grafana}
          navigationMode="document"
          variant="navigation"
        >
          Monitoring
        </AppLink>
      )}
      {hasRole(role, SUPER_ADMIN) && (
        <AppLink
          href={ROUTES.superAdmin}
          variant="navigation"
        >
          Super-Admin
        </AppLink>
      )}
    </Navigation>
  );
}
