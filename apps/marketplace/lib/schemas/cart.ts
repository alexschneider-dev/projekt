import { CART_LIMIT } from "@/lib/cart/config";
import { z } from "zod";
import { ERROR_CART } from "@/lib/http/errors/cart";


export const addToCartSchema = z.object({
  offerId: z.string({ error: ERROR_CART.INVALID.message }).trim()
    .min(1, ERROR_CART.INVALID.message).max(120, ERROR_CART.INVALID.message),
}).strict();
export const cartItemParamsSchema = z.object({
  productId: z.coerce.number({ error: ERROR_CART.INVALID.message })
    .int(ERROR_CART.INVALID.message).min(1, ERROR_CART.INVALID.message).max(2147483647, ERROR_CART.INVALID.message),
});

export const syncCartSchema = z.object({
  offerIds: z.array(addToCartSchema.shape.offerId).max(CART_LIMIT, ERROR_CART.INVALID.message),
}).strict();

// Browserdaten sind Eingaben, keine vertrauenswürdigen Preise oder Produktdaten.
export const localCartSchema = z.array(z.object({
  productId: z.number().int().positive(),
  offer: z.object({
    id: z.string().min(1).max(120),
    priceCents: z.number().int().min(0).max(2147483647),
    stock: z.number().int().min(0),
    active: z.boolean(),
    seller: z.object({ name: z.string().max(200) }),
    product: z.object({
      name: z.string().max(300),
      slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
      published: z.boolean(),
      image: z.null(),
    }),
  }),
})).max(CART_LIMIT);
