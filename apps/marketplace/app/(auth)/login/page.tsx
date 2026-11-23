import { Login } from "@/components/auth/login";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/api-guard";
import { ROUTES } from "@/lib/constants/routes";


export default async function LoginPage() {
  const apiGate = await requireRole();
  if (apiGate.ok) redirect(ROUTES.home);

  return <Login />;
}
