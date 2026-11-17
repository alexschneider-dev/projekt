import { Home } from "@/components/home/home";
import { requireRole } from "@/lib/auth/api-guard";


export default async function HomePage() {
  const apiGate = await requireRole();

  return <Home authenticated={apiGate.ok} />;
}
