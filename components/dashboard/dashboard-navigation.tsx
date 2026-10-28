import { AppLink } from "@/components/ui/app-link";
import { Navigation } from "@/components/ui/navigation";
import {
  hasRole,
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
      {hasRole(
        role,
        "admin",
      ) && (
          <AppLink
            href={ROUTES.admin}
            variant="navigation"
          >
            Administration
          </AppLink>
        )}
      {hasRole(
        role,
        "super_admin",
      ) && (
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
