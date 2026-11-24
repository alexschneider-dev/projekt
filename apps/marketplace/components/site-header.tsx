"use client";

import { usePathname } from "next/navigation";
import {
  useSession,
  signOut
} from "next-auth/react";
import {
  Menu,
  Armchair,
  UserRound
} from "lucide-react";
import { AppLink } from "@/components/ui/app-link";
import { Navigation } from "@/components/ui/navigation";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";
import { withBasePath } from "@/lib/constants/base-path";
import {
  hasRole,
  SUPER_ADMIN
} from "@/lib/auth/roles";


export function SiteHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const links = (
    <>
      <AppLink
        href={ROUTES.home}
        variant="navigation"
      >
        Stühle entdecken
      </AppLink>
      <AppLink
        href={ROUTES.cart}
        variant="navigation"
      >
        Warenkorb
      </AppLink>
      {session?.user ? (
        <>
          <AppLink
            href={ROUTES.dashboard}
            variant="navigation"
          >
            <UserRound size={18} /> Mein Konto
          </AppLink>
          {hasRole(session.user.role, SUPER_ADMIN) && (
            <AppLink
              href={ROUTES.superAdmin}
              variant="navigation"
            >
              Verwaltung
            </AppLink>
          )}
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: withBasePath(ROUTES.home) })}
          >
            Abmelden
          </Button>
        </>
      ) : (
        <>
          <AppLink
            href={ROUTES.login}
            variant="navigation"
          >
            Anmelden
          </AppLink>
          <AppLink
            href={ROUTES.register}
            variant="navigation"
          >
            Registrieren
          </AppLink>
        </>
      )}
    </>
  );
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-5 sm:px-8">
        <AppLink
          href={ROUTES.home}
          variant="brand"
        >
          <Armchair size={28} /> marktplatz<span className="text-primary">.</span>
        </AppLink>
        <Navigation
          aria-label="Hauptnavigation"
          className="hidden items-center lg:flex"
        >
          {links}
        </Navigation>
        <details
          key={pathname}
          className="relative lg:hidden"
        >
          <summary
            aria-label="Menü öffnen"
            className="list-none rounded-lg border p-3"
          >
            <Menu size={22} />
          </summary>
          <Navigation
            aria-label="Mobile Navigation"
            className="absolute right-0 z-30 mt-3 w-64 flex-col rounded-xl border bg-white p-5 shadow-lg"
          >
            {links}
          </Navigation>
        </details>
      </div>
    </header>
  );
}
