import { requireRole } from "@/lib/auth/api-guard";
import { redirectAfterAccessDenied } from "@/lib/auth/access";
import { SectionContent } from "@/components/dashboard/section-content";


export default async function AdminPage() {
  const apiGate = await requireRole();

  if (!apiGate.ok) redirectAfterAccessDenied(apiGate.response);

  return (
    <SectionContent
      title="Administration"
      description="Dieser Bereich ist für angemeldete Benutzer freigegeben."
    />
  );
}
