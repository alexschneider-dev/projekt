"use client";

import type { Table } from "@tanstack/react-table";
import {
  usePathname,
  useSearchParams,
} from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AppLink } from "@/components/ui/app-link";
import { Navigation } from "@/components/ui/navigation";
import { Text } from "@/components/ui/text";
import { paginationPages } from "@/lib/shared/pagination";
import {
  createPageQueryString,
  createQueryHref,
} from "@/lib/shared/search-params/query-state";


export function TablePagination<TData>({
  table,
  total,
}: {
  table: Table<TData>;
  total: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = table.getState().pagination.pageIndex + 1;
  const pageCount = table.getPageCount();
  const href = (page: number) => createQueryHref(pathname, createPageQueryString(searchParams.toString(), page));

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {pageCount > 1 && (
        <Navigation
          aria-label="Seitennavigation"
          className="gap-0.5 sm:gap-1"
        >
          {current > 1 && (
            <AppLink
              href={href(current - 1)}
              variant="pagination"
              aria-label="Zurück"
              scroll={false}
            >
              <ChevronLeft
                aria-hidden
                className="size-4"
              />
            </AppLink>
          )}
          {paginationPages(current, pageCount).map((page, index) => page === "ellipsis" ? (
            <Text
              key={`ellipsis-${index}`}
              as="span"
              aria-hidden
              className="flex h-9 w-3 items-center justify-center sm:h-11 sm:w-4"
            >
              …
            </Text>
          ) : (
            <AppLink
              key={page}
              href={href(page)}
              variant="pagination"
              aria-label={`Seite ${page}`}
              aria-current={page === current ? "page" : undefined}
              scroll={false}
            >
              {page}
            </AppLink>
          ))}
          {current < pageCount && (
            <AppLink
              href={href(current + 1)}
              variant="pagination"
              aria-label="Weiter"
              scroll={false}
            >
              <ChevronRight
                aria-hidden
                className="size-4"
              />
            </AppLink>
          )}
        </Navigation>
      )}
      <Text
        as="span"
        variant="meta"
        role="status"
      >
        Seite {current} von {pageCount} · {total} Stellen
      </Text>
    </div>
  );
}
