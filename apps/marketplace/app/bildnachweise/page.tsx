import { Credits } from "@/components/catalog/credits";


export const dynamic = "force-dynamic";

export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const raw = Number((await searchParams).page ?? 1);
  const page = Number.isSafeInteger(raw) && raw > 0 && raw <= 1000 ? raw : 1;
  return <Credits page={page} />;
}
