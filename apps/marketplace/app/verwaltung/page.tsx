import { requireRole } from "@/lib/auth/api-guard";
import { redirectAfterAccessDenied } from "@/lib/auth/access";
import { SUPER_ADMIN } from "@/lib/auth/roles";
import { Admin } from "@/components/account/admin";


export default async function AdminPage() {
  const apiGate = await requireRole(SUPER_ADMIN);
  if (!apiGate.ok) redirectAfterAccessDenied(apiGate.response);
  return <Admin />;
}
