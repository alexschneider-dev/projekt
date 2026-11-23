"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { fetchJson } from "@/lib/http/fetch-json";
import { ROUTES } from "@/lib/constants/routes";
import {
  catalogQuery,
  type CatalogFilters
} from "@/lib/schemas/catalog";
import type { ProductsPage } from "@/lib/catalog/service";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import PageWrapper from "@/components/ui/page/page-wrapper";
import { ERROR_CATALOG } from "@/lib/http/errors/catalog";
import { Filters } from "./filters";
import { ProductCard } from "./product-card";


export function Catalog({
  filters,
  initialData
}: {
  filters: CatalogFilters;
  initialData: ProductsPage | null
}) {
  const router = useRouter();
  const queryString = catalogQuery(filters);
  const query = useQuery({
    queryKey: [
      "products",
      queryString
    ],
    queryFn: ({ signal }) =>
      fetchJson<ProductsPage>(`${ROUTES.productsApi}?${queryString}`, {
        method: "GET",
        signal,
      }),
    ...(initialData ? { initialData } : {}),
  });
  const apply = (values: CatalogFilters) => router.push(`${ROUTES.home}?${catalogQuery(values)}`, { scroll: false });
  return (
    <PageWrapper>
      <section className="mb-9 border-b pb-9 pt-4">
        <Text variant="meta">WOHNEN / STÜHLE</Text>
        <h1 className="mt-4">Ein guter Platz zum Bleiben.</h1>
        <Text variant="description">
          Stühle für deinen Alltag. Entdecke Materialien, Formen und Angebote verschiedener Verkäufer.
        </Text>
      </section>
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside
          className="hidden lg:block"
          aria-label="Produktfilter"
        >
          <h2 className="mb-6">Deine Auswahl</h2>
          <Filters
            key={queryString}
            values={filters}
            onApply={apply}
          />
        </aside>
        <section
          aria-label="Produkte"
          className="min-w-0"
        >
          <details className="mb-6 rounded-xl border bg-white p-4 lg:hidden">
            <summary className="flex items-center gap-2 font-medium">
              <SlidersHorizontal size={18} /> Filtern und sortieren
            </summary>
            <div className="mt-6">
              <Filters
                key={queryString}
                values={filters}
                onApply={apply}
              />
            </div>
          </details>
          <div className="mb-5 flex items-center justify-between">
            <h2>Stühle entdecken</h2>
            <Text variant="meta">Seite {filters.page}</Text>
          </div>
          {query.isPending && <Text role="status">Produkte werden geladen …</Text>}
          {query.isError && (
            <div className="space-y-4">
              <Text
                role="alert"
                variant="error"
              >
                {ERROR_CATALOG.UNAVAILABLE.message}
              </Text>
              <Button onClick={() => query.refetch()}>Erneut laden</Button>
            </div>
          )}
          {query.data && (
            <>
              {query.data.items.length ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {query.data.items.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border p-8">
                  <h2>Keine passenden Stühle</h2>
                  <Text variant="description">Ändere deine Filter oder setze sie zurück.</Text>
                </div>
              )}
              <div className="mt-8 flex justify-between gap-4">
                <Button
                  variant="outline"
                  disabled={filters.page === 1}
                  onClick={() =>
                    apply({
                      ...filters,
                      page: filters.page - 1,
                    })
                  }
                >
                  Zurück
                </Button>
                <Button
                  variant="outline"
                  disabled={!query.data.hasNext || filters.page >= 1000}
                  onClick={() =>
                    apply({
                      ...filters,
                      page: filters.page + 1,
                    })
                  }
                >
                  Weiter
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </PageWrapper>
  );
}
