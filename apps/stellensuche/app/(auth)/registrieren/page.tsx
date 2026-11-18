import { Registration } from "@/components/auth/registration";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/api-guard";
import { ROUTES } from "@/lib/constants/routes";


export default async function Page() {
  const apiGate = await requireRole();
  if (apiGate.ok) redirect(ROUTES.home);

  return <Registration />;
}
