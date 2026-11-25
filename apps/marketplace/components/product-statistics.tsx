"use client";

import { Text } from "@/components/ui/text";
import { useProductStatistics } from "@/hooks/statistics/use-product-statistics";


export function ProductStatistics() {
  const snapshot = useProductStatistics();

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Text
        as="span"
        variant="meta"
        className="inline-flex items-center gap-2 font-semibold"
      >
        <span
          aria-hidden="true"
          className={snapshot?.available
            ? "size-2 rounded-full bg-emerald-600 motion-safe:animate-pulse"
            : "size-2 rounded-full bg-muted-foreground"}
        />
        Live · Echtzeit
      </Text>
      <Text
        as="span"
        variant="meta"
        className="tabular-nums"
      >
        {!snapshot?.available
          ? "Verbindung oder Daten derzeit nicht verfügbar"
          : `${snapshot.products.toLocaleString("de-DE")} ${snapshot.products === 1 ? "verfügbares Produkt" : "verfügbare Produkte"} · ${snapshot.sellers.toLocaleString("de-DE")} ${snapshot.sellers === 1 ? "aktiver Verkäufer" : "aktive Verkäufer"}`}
      </Text>
    </div>
  );
}
