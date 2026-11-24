"use client";

import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode
} from "react";
import { useSession } from "next-auth/react";
import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { fetchJson } from "@/lib/http/fetch-json";
import {
  ROUTES,
  cartItemApiHref
} from "@/lib/constants/routes";
import type {
  Cart,
  CartSync
} from "@/lib/cart/service";
import {
  addLocalItem,
  removeLocalItem,
  readLocalCart,
  parseLocalCart,
  subscribeLocalCart,
  clearSyncedCart
} from "@/lib/cart/local";


const serverSnapshot = () => null;
const subscribeHydration = () => () => { };

function useCartState() {
  const {
    data: session,
    status
  } = useSession();
  const userId = session?.user?.id;
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const raw = useSyncExternalStore(subscribeLocalCart, readLocalCart, serverSnapshot);
  const local = useMemo(() => parseLocalCart(raw), [raw]);
  const [
    notice,
    setNotice
  ] = useState<{
    userId: string;
    skipped: number
  } | null>(null);
  const queryKey = [
    "cart",
    userId
  ] as const;
  const client = useQueryClient();
  const remote = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const snapshot = readLocalCart();
      const guest = parseLocalCart(snapshot);
      if (guest.items.length) {
        const result = await fetchJson<CartSync>(ROUTES.cartSyncApi, {
          method: "POST",
          body: { offerIds: guest.items.map(item => item.offer.id) },
          signal
        });
        clearSyncedCart(snapshot);
        setNotice({
          userId: userId!,
          skipped: result.skipped.length
        });
        return result.cart;
      }

      return fetchJson<Cart>(ROUTES.cartApi, { signal });
    },
    enabled: Boolean(userId) && hydrated,
    staleTime: 0
  });

  const changed = async (result: {
    cart: Cart;
    userId: string | undefined
  }) => {
    if (!result.userId) return;
    const ownerKey = [
      "cart",
      result.userId
    ];
    client.setQueryData(ownerKey, result.cart);
    await client.invalidateQueries({ queryKey: ownerKey });
  };
  const add = useMutation({
    mutationFn: async (item: Cart["items"][number]) => ({
      userId,
      cart: userId
        ? await fetchJson<Cart>(ROUTES.cartApi, {
          method: "POST",
          body: { offerId: item.offer.id }
        })
        : addLocalItem(item)
    }),
    onSuccess: changed,
  });
  const remove = useMutation({
    mutationFn: async (productId: number) => ({
      userId,
      cart: userId
        ? await fetchJson<Cart>(cartItemApiHref(productId), { method: "DELETE" })
        : removeLocalItem(productId)
    }),
    onSuccess: changed,
  });

  return {
    query: {
      data: userId ? remote.data : hydrated ? local : undefined,
      isPending: status === "loading" || !hydrated || Boolean(userId && remote.isPending),
      isError: Boolean(userId && remote.isError),
      error: userId ? remote.error : null,
      refetch: remote.refetch,
    },
    add,
    remove,
    authenticated: Boolean(userId),
    loadingSession: status === "loading",
    skipped: notice?.userId === userId ? notice?.skipped ?? 0 : 0,
  };
}

const CartContext = createContext<ReturnType<typeof useCartState> | null>(null);

export function CartProvider({ children }: { children?: ReactNode }) {
  const value = useCartState();
  return createElement(CartContext.Provider, { value }, children);
}

export function useCart() {
  return useContext(CartContext)!;
}
