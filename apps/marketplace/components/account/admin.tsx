import { DemoProducts } from "./demo-products";
import { MasterData } from "./master-data";
import { AppLink } from "@/components/ui/app-link";
import { ROUTES } from "@/lib/constants/routes";
import { prisma } from "@/lib/prisma";
import PageWrapper from "@/components/ui/page/page-wrapper";
import { Text } from "@/components/ui/text";


export async function Admin() {
  const counts = await Promise.all([
    prisma.product.count(),
    prisma.seller.count(),
    prisma.imageAsset.count()
  ]);
  return (
    <PageWrapper>
      <h1>Verwaltung</h1>
      <Text variant="intro">Übersicht des Marktplatzes</Text>
      <AppLink
        href={ROUTES.grafana}
        navigationMode="document"
      >
        Grafana öffnen
      </AppLink>
      <dl className="grid gap-5 sm:grid-cols-3">
        {[
          "Produkte",
          "Verkäufer",
          "Bildmotive"
        ].map((label, index) => (
          <div
            key={label}
            className="rounded-xl border bg-white p-6"
          >
            <dt>{label}</dt>
            <dd className="mt-3 text-3xl font-semibold">{counts[index]?.toLocaleString("de-DE")}</dd>
          </div>
        ))}
      </dl>
      <MasterData />
      <DemoProducts />
    </PageWrapper>
  );
}
