import type { Cart } from "./service";
import { CART_LIMIT } from "./config";
import { localCartSchema } from "@/lib/schemas/cart";
import { createApiError } from "@/lib/http/errors";
import { ERROR_CART } from "@/lib/http/errors/cart";


export const CART_STORAGE_KEY = "marketplace.guest-cart.v1";
const eventName = "marketplace-cart-changed";

export function readLocalCart() {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parseLocalCart(raw: string | null): Cart {
  let items: Cart["items"] = [];
  try {
    const parsed = localCartSchema.safeParse(JSON.parse(raw ?? "[]"));
    if (parsed.success) {
      items = parsed.data.filter((item, index, all) => all.findIndex(other => other.productId === item.productId) === index);
    }
  } catch {
    // Beschädigte Browserdaten werden nicht übernommen.
  }

  return {
    items,
    limit: CART_LIMIT,
    totalCents: items.reduce((sum, item) => sum + item.offer.priceCents, 0)
  };
}

function save(items: Cart["items"]) {
  const normalized = localCartSchema.safeParse(items.map(item => ({
    ...item,
    offer: {
      ...item.offer,
      product: {
        ...item.offer.product,
        image: null
      }
    }
  })));
  if (!normalized.success) throw createApiError(ERROR_CART.INVALID);

  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized.data));
  } catch {
    throw createApiError(ERROR_CART.STORAGE);
  }
  window.dispatchEvent(new Event(eventName));
  return parseLocalCart(readLocalCart());
}

export function addLocalItem(item: Cart["items"][number]) {
  const cart = parseLocalCart(readLocalCart());
  if (cart.items.some(existing => existing.productId === item.productId)) return cart;
  if (cart.items.length >= CART_LIMIT) throw createApiError(ERROR_CART.FULL);

  return save([
    ...cart.items,
    item
  ]);
}

export function removeLocalItem(productId: number) {
  return save(parseLocalCart(readLocalCart()).items.filter(item => item.productId !== productId));
}

export function clearSyncedCart(snapshot: string | null) {
  // Zwischenzeitliche Änderungen eines anderen Tabs bleiben erhalten.
  if (readLocalCart() === snapshot) save([]);
}

export function subscribeLocalCart(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(eventName, listener);
  };
}
