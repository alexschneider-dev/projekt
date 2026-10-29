import { ADMIN } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/api-guard";
import { redirectAfterAccessDenied } from "@/lib/auth/access";
import { SectionContent } from "@/components/dashboard/section-content";


export default async function AdminPage() {
  const apiGate = await requireRole(ADMIN);

  if (!apiGate.ok) redirectAfterAccessDenied(apiGate.response);

  return (
    <SectionContent
      title="Administration"
      description="Dieser Bereich ist für Admins und Super-Admins freigegeben."
    />
  );
}
