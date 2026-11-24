"use client";

import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef
} from "@tanstack/react-table";


export function DataTable<T>({
  data,
  columns,
  caption,
  rowHref
}: {
  data: T[];
  columns: ColumnDef<T>[];
  caption: string;
  rowHref?: (item: T) => string;
}) {
  const router = useRouter();
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
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
              className={rowHref ? "cursor-pointer border-b hover:bg-muted/50 focus-within:bg-muted/50" : "border-b"}
              onClick={rowHref ? (event) => {
                if ((event.target as HTMLElement).closest("a, button, input, select")) return;
                router.push(rowHref(row.original));
              } : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="p-4 wrap-anywhere"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
