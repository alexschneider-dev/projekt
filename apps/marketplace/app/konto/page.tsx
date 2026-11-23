import { requireRole } from "@/lib/auth/api-guard";
import { redirectAfterAccessDenied } from "@/lib/auth/access";
import { Account } from "@/components/account/account";


export default async function AccountPage() {
  const apiGate = await requireRole();
  if (!apiGate.ok) redirectAfterAccessDenied(apiGate.response);
  return <Account
    email={apiGate.user.email ?? ""}
    role={apiGate.user.role}
  />;
}
