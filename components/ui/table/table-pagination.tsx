"use client";

import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/ui/navigation";
import { Text } from "@/components/ui/text";


export function TablePagination<TData>({
  table,
  total,
}: {
  table: Table<TData>;
  total: number;
}) {
  return (
    <Navigation
      aria-label="Seitennavigation"
      className="items-center justify-between gap-3"
    >
      <Button
        variant="outline"
        disabled={!table.getCanPreviousPage()}
        onClick={() => table.previousPage()}
      >
        Zurück
      </Button>
      <Text
        as="span"
        variant="meta"
        role="status"
      >
        Seite {table.getState().pagination.pageIndex + 1} von {table.getPageCount()} · {total} Stellen
      </Text>
      <Button
        variant="outline"
        disabled={!table.getCanNextPage()}
        onClick={() => table.nextPage()}
      >
        Weiter
      </Button>
    </Navigation>
  );
}
