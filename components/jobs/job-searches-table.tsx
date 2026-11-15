"use client";

import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { AppLink } from "@/components/ui/app-link";
import { DataTable } from "@/components/ui/table/data-table";
import type { JobSearchesResult } from "@/lib/types/jobs";
import { jobSearchHref } from "@/lib/constants/routes";
import { SearchLastResult } from "./search-last-result";


const columns: ColumnDef<JobSearchesResult[number]>[] = [
  {
    accessorKey: "title",
    header: "Titel",
    cell: ({ row }) => (
      <AppLink
        href={jobSearchHref(row.original.id)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {row.original.title}
      </AppLink>
    ),
  },
  {
    accessorKey: "url",
    header: "Such-URL",
    cell: ({ row }) => (
      <AppLink
        href={row.original.url}
        navigationMode="document"
        target="_blank"
        rel="noopener noreferrer"
      >
        {row.original.url}
      </AppLink>
    ),
  },
  {
    accessorKey: "lastResultCount",
    header: "Letzter erfolgreicher Abruf",
    cell: ({ row }) => <SearchLastResult search={row.original} />,
  },
  {
    accessorKey: "active",
    header: "Status",
    cell: ({ row }) => row.original.active ? "Aktiv" : "Inaktiv",
  },
];

export function JobSearchesTable({ items }: { items: JobSearchesResult }) {
  "use no memo";

  // Die Tabelle bleibt bewusst außerhalb der automatischen React-Memoisierung.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
  });

  return (
    <DataTable
      table={table}
      label="Gespeicherte Such-URLs"
      emptyMessage="Noch keine Such-URLs gespeichert."
    />
  );
}
