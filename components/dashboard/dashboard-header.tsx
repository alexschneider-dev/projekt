import Link from "next/link";
import type { Session } from "next-auth";
import { roleLabels } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/auth/logout-button";


export function DashboardHeader({ user }: { user: NonNullable<Session["user"]> }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
      <Link
        href="/"
        className="font-semibold focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4"
      >
        Projekt
      </Link>
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <span className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{user.name ?? user.email} · {roleLabels[user.role]}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
