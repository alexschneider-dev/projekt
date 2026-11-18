import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/api-guard";
import { redirectAfterAccessDenied } from "@/lib/auth/access";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";


export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const apiGate = await requireRole();

  if (!apiGate.ok) redirectAfterAccessDenied(apiGate.response);

  const { user } = apiGate;

  return (
    <DashboardShell user={user}>{children}</DashboardShell>
  );
}
