import { z } from "zod";
import { ERROR_MASTER_DATA } from "@/lib/http/errors/master-data";


const identifier = z.string().trim().min(1).max(120);
export const dictionarySchema = z.enum([
  "materials",
  "colors",
  "chair-types",
  "model-names"
]);
export const dictionaryParamsSchema = z.object({ dictionary: dictionarySchema });
export const optionParamsSchema = dictionaryParamsSchema.extend({ id: identifier });
export const optionQuerySchema = z.object({
  categoryId: identifier.default("chairs"),
  includeInactive: z.enum([
    "true",
    "false"
  ]).default("false"),
});
export const optionBodySchema = z.object({
  label: z.string().trim().min(1, ERROR_MASTER_DATA.INVALID.message).max(80, ERROR_MASTER_DATA.INVALID.message),
  active: z.boolean(),
}).strict();
export type OptionInput = z.output<typeof optionBodySchema>;
