import { SUPER_ADMIN } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/api-guard";
import { redirectAfterAccessDenied } from "@/lib/auth/access";
import { SectionContent } from "@/components/dashboard/section-content";


export default async function SuperAdminPage() {
  const apiGate = await requireRole(SUPER_ADMIN);

  if (!apiGate.ok) redirectAfterAccessDenied(apiGate.response);

  return (
    <SectionContent
      title="Super-Admin"
      description="Dieser Bereich ist ausschließlich für Super-Admins freigegeben."
    />
  );
}
