import { requireUser } from "@/lib/auth/access";
import { SectionContent } from "@/components/dashboard/section-content";

export default async function SuperAdminPage() {
  await requireUser("super_admin");
  return (
  <SectionContent
      title="Super-Admin"
      description="Dieser Bereich ist ausschließlich für Super-Admins freigegeben."
    />
  );
}
