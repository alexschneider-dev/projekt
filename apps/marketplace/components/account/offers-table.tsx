"use client";

import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef
} from "@tanstack/react-table";
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
  const table = useReactTable({
    data: query.data ?? empty,
    columns,
    getCoreRowModel: getCoreRowModel(),
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
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Eigene Verkäuferangebote</caption>
          <thead className="border-b bg-muted">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap p-4"
                    scope="col"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="p-4"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.isSuccess && !query.data.length && <Text variant="hint">Du hast noch keine Angebote.</Text>}
    </PageWrapper>
  );
}
