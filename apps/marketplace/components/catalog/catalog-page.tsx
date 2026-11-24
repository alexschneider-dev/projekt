import { getChairFilters } from "@/lib/catalog/master-data";
import { Catalog } from "./catalog";
import { catalogSchema } from "@/lib/schemas/catalog";
import { listProducts } from "@/lib/catalog/service";
import { Text } from "@/components/ui/text";
import PageWrapper from "@/components/ui/page/page-wrapper";
import { AppLink } from "@/components/ui/app-link";
import { ROUTES } from "@/lib/constants/routes";
import { ERROR_CATALOG } from "@/lib/http/errors/catalog";
import { log } from "@/lib/observability/logger";


export async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = catalogSchema.safeParse(await searchParams);
  if (!parsed.success)
    return (
      <PageWrapper>
        <h1>Filter prüfen</h1>
        <Text variant="description">{ERROR_CATALOG.FILTER.message}</Text>
        <AppLink href={ROUTES.home}>Alle Stühle anzeigen</AppLink>
      </PageWrapper>
    );
  const data = await Promise.all([
    listProducts(parsed.data),
    getChairFilters()
  ]).catch(() => {
    log("error", ERROR_CATALOG.UNAVAILABLE.code);
    return null;
  });
  return <Catalog
    filters={parsed.data}
    initialData={data?.[0] ?? null}
    options={data?.[1] ?? null}
  />;
}
