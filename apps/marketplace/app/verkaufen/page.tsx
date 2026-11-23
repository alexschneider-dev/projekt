import { requireRole } from "@/lib/auth/api-guard";
import { redirectAfterAccessDenied } from "@/lib/auth/access";
import { SELLER } from "@/lib/auth/roles";
import { OffersTable } from "@/components/account/offers-table";


export default async function SellerPage() {
  const apiGate = await requireRole(SELLER);
  if (!apiGate.ok) redirectAfterAccessDenied(apiGate.response);
  return <OffersTable />;
}
