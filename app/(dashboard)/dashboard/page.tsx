import { requireRole } from "@/lib/auth/api-guard";
import { redirectAfterAccessDenied } from "@/lib/auth/access";
import { SectionContent } from "@/components/dashboard/section-content";


export default async function DashboardPage() {
  const apiGate = await requireRole();

  if (!apiGate.ok) redirectAfterAccessDenied(apiGate.response);

  const { user } = apiGate;

  return (
    <SectionContent
      title={`Hallo, ${user.name ?? user.email}`}
      description="Du bist im internen Bereich angemeldet."
    />
  );
}
