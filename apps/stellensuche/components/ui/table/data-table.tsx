"use client";

import {
  flexRender,
  type Table,
} from "@tanstack/react-table";
import { Text } from "@/components/ui/text";


export function DataTable<TData>({
  table,
  label,
  emptyMessage = "Keine Einträge vorhanden.",
}: {
  table: Table<TData>;
  label: string;
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full table-fixed text-left">
        <caption className="sr-only">{label}</caption>
        <thead className="border-b bg-muted">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className="px-4 py-3 font-medium"
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y">
          {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="wrap-anywhere px-4 py-3 align-top"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td
                colSpan={table.getAllColumns().length}
                className="p-6"
              >
                <Text variant="meta">{emptyMessage}</Text>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
