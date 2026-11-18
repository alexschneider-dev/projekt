import { Text } from "@/components/ui/text";
import { AppLink } from "@/components/ui/app-link";
import { ROUTES } from "@/lib/constants/routes";
import type { Session } from "next-auth";
import { roleLabels } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/auth/logout-button";


export function DashboardHeader({ user }: { user: NonNullable<Session["user"]> }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
      <AppLink
        href={ROUTES.home}
        variant="brand"
      >
        Projekt
      </AppLink>
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <Text
          as="span"
          variant="meta"
        >
          {user.name ?? user.email} · {roleLabels[user.role]}
        </Text>
        <LogoutButton />
      </div>
    </header>
  );
}
