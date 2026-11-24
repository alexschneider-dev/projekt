import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/api-guard";
import { redirectAfterAccessDenied } from "@/lib/auth/access";
import { SUPER_ADMIN } from "@/lib/auth/roles";
import { dictionaryForSection } from "@/lib/catalog/dictionaries";
import { MasterDataList } from "@/components/account/master-data/list";


export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const apiGate = await requireRole(SUPER_ADMIN);
  if (!apiGate.ok) redirectAfterAccessDenied(apiGate.response);

  const values = await params;
  const dictionary = dictionaryForSection(values.section);
  if (!dictionary) notFound();

  return <MasterDataList dictionary={dictionary} />;
}
