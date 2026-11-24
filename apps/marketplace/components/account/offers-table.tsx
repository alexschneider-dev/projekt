"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import type { SellerOffers } from "@/lib/catalog/service";
import { fetchJson } from "@/lib/http/fetch-json";
import {
  ROUTES,
  productHref
} from "@/lib/constants/routes";
import { formatPrice } from "@/lib/catalog/config";
import { AppLink } from "@/components/ui/app-link";
import { Text } from "@/components/ui/text";
import PageWrapper from "@/components/ui/page/page-wrapper";
import { ERROR_CATALOG } from "@/lib/http/errors/catalog";


const columns: ColumnDef<SellerOffers[number]>[] = [
  {
    header: "Produkt",
    accessorKey: "product.name",
    cell: ({ row }) => <AppLink href={productHref(row.original.product.slug)}>{row.original.product.name}</AppLink>,
  },
  {
    header: "Preis",
    accessorKey: "priceCents",
    cell: ({ row }) => formatPrice(row.original.priceCents),
  },
  {
    header: "Bestand",
    accessorKey: "stock",
  },
  {
    header: "Lieferzeit",
    accessorKey: "deliveryDays",
    cell: ({ row }) => `${row.original.deliveryDays} Werktage`,
  },
  {
    header: "Status",
    accessorKey: "active",
    cell: ({ row }) => (row.original.active ? "Aktiv" : "Inaktiv"),
  },
];
const empty: SellerOffers = [];

export function OffersTable() {
  const query = useQuery({
    queryKey: ["seller-offers"],
    queryFn: () => fetchJson<SellerOffers>(ROUTES.offersApi, { method: "GET" }),
  });
  return (
    <PageWrapper>
      <h1>Meine Angebote</h1>
      <Text variant="intro">Die ersten 100 Angebote deines Verkäuferkontos.</Text>
      {query.isError && (
        <Text
          role="alert"
          variant="error"
        >
          {ERROR_CATALOG.UNAVAILABLE.message}
        </Text>
      )}
      {query.isPending && <Text role="status">Angebote werden geladen …</Text>}
      <DataTable
        data={query.data ?? empty}
        columns={columns}
        caption="Eigene Verkäuferangebote"
      />
      {query.isSuccess && !query.data.length && <Text variant="hint">Du hast noch keine Angebote.</Text>}
    </PageWrapper>
  );
}
