import BodyWrapper from "@/components/ui/page/body-wrapper";
import PageWrapper from "@/components/ui/page/page-wrapper";
import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { DashboardHeader } from "./dashboard-header";
import { DashboardNavigation } from "./dashboard-navigation";


type DashboardShellProps = {
  user: NonNullable<Session["user"]>;
  children: ReactNode
};

export function DashboardShell({
  user,
  children
}: DashboardShellProps) {
  return (
    <BodyWrapper variant="dashboard">
      <DashboardHeader user={user} />
      <PageWrapper>
        <DashboardNavigation role={user.role} />
        {children}
      </PageWrapper>
    </BodyWrapper>
  );
}
