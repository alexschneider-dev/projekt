import { z } from "zod";
import { ERRORS } from "../errors/index.mjs";


const sourceUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && [
    "www.pexels.com",
    "pexels.com"
  ].includes(url.hostname);
}, ERRORS.SOURCE);
export const candidateSchema = z.object({
  id: z.number().int().positive(),
  sourceUrl,
  photographer: z.string().min(1).max(200),
  photographerUrl: sourceUrl,
  downloadUrl: z
    .url()
    .refine(
      (value) => new URL(value).hostname === "images.pexels.com" && new URL(value).protocol === "https:",
      ERRORS.SOURCE,
    ),
  previewUrl: z
    .url()
    .refine(
      (value) => new URL(value).hostname === "images.pexels.com" && new URL(value).protocol === "https:",
      ERRORS.SOURCE,
    ),
  alt: z.string().min(1).max(500),
  approved: z.boolean().default(false),
  material: z.enum([
    "Holz",
    "Metall",
    "Kunststoff",
    "Polster"
  ]).optional(),
  color: z.enum([
    "Natur",
    "Schwarz",
    "Weiß",
    "Grau",
    "Grün"
  ]).optional(),
  kind: z.enum([
    "Esszimmerstuhl",
    "Bürostuhl",
    "Loungestuhl",
    "Barhocker"
  ]).optional(),
});
export const manifestSchema = z
  .array(candidateSchema)
  .max(10000)
  .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length, ERRORS.MANIFEST);
export function approvedImages(rows) {
  const result = manifestSchema.parse(rows).filter((row) => row.approved);
  if (!result.length || result.some((row) => !row.material || !row.color || !row.kind))
    throw new Error(ERRORS.MANIFEST);
  return result;
}
