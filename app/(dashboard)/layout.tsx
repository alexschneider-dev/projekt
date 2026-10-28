import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/access";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";


export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <DashboardShell user={user}>{children}</DashboardShell>
  );
}
