import Link from "next/link";
import { hasRole, type InternalRole } from "@/lib/auth/roles";


export function DashboardNavigation({ role }: { role: InternalRole }) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="mb-10 flex flex-wrap gap-5 text-sm [&_a]:underline [&_a]:underline-offset-4 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-primary [&_a:focus-visible]:outline-offset-4"
    >
      <Link href="/dashboard">Übersicht</Link>
      {hasRole(role, "admin") && <Link href="/admin">Administration</Link>}
      {hasRole(role, "super_admin") && <Link href="/super-admin">Super-Admin</Link>}
    </nav>
  );
}
