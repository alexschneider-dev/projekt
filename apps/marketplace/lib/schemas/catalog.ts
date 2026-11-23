import { z } from "zod";
import { ERROR_CATALOG } from "@/lib/http/errors/catalog";
import { chairFilters } from "@/lib/catalog/config";


const price = z.coerce
  .number()
  .int(ERROR_CATALOG.FILTER.message)
  .min(0, ERROR_CATALOG.FILTER.message)
  .max(100000, ERROR_CATALOG.FILTER.message)
  .default(0);
export const catalogSchema = z
  .object({
    q: z.string().trim().max(80, ERROR_CATALOG.FILTER.message).default(""),
    material: z.enum([
      "",
      ...chairFilters.material.values
    ], { error: ERROR_CATALOG.FILTER.message }).default(""),
    color: z.enum([
      "",
      ...chairFilters.color.values
    ], { error: ERROR_CATALOG.FILTER.message }).default(""),
    kind: z.enum([
      "",
      ...chairFilters.kind.values
    ], { error: ERROR_CATALOG.FILTER.message }).default(""),
    min: price,
    max: price,
    sort: z.enum([
      "newest",
      "priceAsc",
      "priceDesc"
    ], { error: ERROR_CATALOG.FILTER.message }).default("newest"),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .refine((value) => !value.max || value.min <= value.max, {
    message: ERROR_CATALOG.PRICE.message,
    path: ["max"],
  });
export const productParamsSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/) });
export type CatalogFilters = z.output<typeof catalogSchema>;

export function catalogQuery(filters: CatalogFilters) {
  const query = new URLSearchParams();
  for (const [
    key,
    value
  ] of Object.entries(filters)) {
    if (value !== "" && value !== 0 && !(key === "page" && value === 1) && !(key === "sort" && value === "newest")) {
      query.set(key, String(value));
    }
  }
  return query.toString();
}
