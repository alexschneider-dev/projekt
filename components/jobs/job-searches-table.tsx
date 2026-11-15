"use client";

import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { AppLink } from "@/components/ui/app-link";
import { DataTable } from "@/components/ui/table/data-table";
import type { JobSearchesResult } from "@/lib/types/jobs";


const columns: ColumnDef<JobSearchesResult[number]>[] = [
  {
    accessorKey: "url",
    header: "Such-URL",
    cell: ({ row }) => (
      <AppLink
        href={row.original.url}
        navigationMode="document"
      >
        {row.original.url}
      </AppLink>
    ),
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
