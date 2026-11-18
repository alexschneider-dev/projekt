"use client";

import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { AppLink } from "@/components/ui/app-link";
import { DataTable } from "@/components/ui/table/data-table";
import { TablePagination } from "@/components/ui/table/table-pagination";
import { JobStatusSelect } from "./job-status-select";
import type {
  JobLink,
  JobsPageResult,
} from "@/lib/types/jobs";


const columns: ColumnDef<JobLink>[] = [
  {
    accessorKey: "url",
    header: "Stellenlink",
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
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <JobStatusSelect job={row.original} />,
  },
];

export function JobsTable({
  result,
  onPageChange,
}: {
  result: JobsPageResult;
  onPageChange: (page: number) => void;
}) {
  "use no memo";

  const pagination = {
    pageIndex: result.page - 1,
    pageSize: result.pageSize,
  };
  // Die Tabelle bleibt bewusst außerhalb der automatischen React-Memoisierung.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: result.items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    manualPagination: true,
    pageCount: result.pageCount,
    state: { pagination },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(pagination) : updater;
      onPageChange(next.pageIndex + 1);
    },
  });

  return (
    <div className="space-y-4">
      <DataTable
        table={table}
        label="Gespeicherte Stellen"
        emptyMessage="Noch keine Stellen gefunden."
      />
      <TablePagination
        table={table}
        total={result.total}
      />
    </div>
  );
}
