import { z } from "zod";
import { ERROR_OFFERS } from "@/lib/http/errors/offers";


export const offerParamsSchema = z.object({
  offerId: z.string({ error: ERROR_OFFERS.INVALID.message })
    .min(1, ERROR_OFFERS.INVALID.message).max(120, ERROR_OFFERS.INVALID.message)
});
export const offerAvailabilitySchema = z.object({
  active: z.boolean({ error: ERROR_OFFERS.INVALID.message }),
  stock: z.number({ error: ERROR_OFFERS.INVALID.message })
    .int(ERROR_OFFERS.INVALID.message).min(0, ERROR_OFFERS.INVALID.message).max(2147483647, ERROR_OFFERS.INVALID.message)
}).strict();
export type OfferAvailabilityInput = z.infer<typeof offerAvailabilitySchema>;
