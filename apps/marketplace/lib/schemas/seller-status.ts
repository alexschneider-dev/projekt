import { z } from "zod";
import { ERROR_SELLERS } from "@/lib/http/errors/sellers";


export const sellerParamsSchema = z.object({
  sellerId: z.string({ error: ERROR_SELLERS.INVALID.message })
    .min(1, ERROR_SELLERS.INVALID.message).max(120, ERROR_SELLERS.INVALID.message)
});
export const sellerStatusSchema = z.object({
  active: z.boolean({ error: ERROR_SELLERS.INVALID.message })
}).strict();
export type SellerStatusInput = z.infer<typeof sellerStatusSchema>;
