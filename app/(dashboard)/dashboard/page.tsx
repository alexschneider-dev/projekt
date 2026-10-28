import { requireUser } from "@/lib/auth/access";
import { SectionContent } from "@/components/dashboard/section-content";


export default async function DashboardPage() {
  const user = await requireUser();
  return (
  <SectionContent
      title={`Hallo, ${user.name ?? user.email}`}
      description="Du bist im internen Bereich angemeldet."
    />
  );
}
