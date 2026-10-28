import { requireUser } from "@/lib/auth/access";
import { SectionContent } from "@/components/dashboard/section-content";


export default async function AdminPage() {
  await requireUser("admin");
  return (
    <SectionContent
      title="Administration"
      description="Dieser Bereich ist für Admins und Super-Admins freigegeben."
    />
  );
}
