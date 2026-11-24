"use client";

import { useCart } from "@/hooks/cart/use-cart";
import { CART_LIMIT } from "@/lib/cart/config";
import { ERROR_CART } from "@/lib/http/errors/cart";
import { ApiError } from "@/lib/http/api-error";
import type { Cart } from "@/lib/cart/service";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Text } from "@/components/ui/text";


export function AddToCart({
  item,
  available
}: {
  item: Cart["items"][number];
  available: boolean
}) {
  const {
    query,
    add,
    loadingSession
  } = useCart();
  const present = query.data?.items.some((entry) => entry.productId === item.productId) ?? false;
  const full = (query.data?.items.length ?? 0) >= CART_LIMIT;

  return (
    <div className="space-y-2">
      <Button
        disabled={loadingSession || query.isPending || query.isError || !available || present || full || add.isPending}
        onClick={() => add.mutate(item)}
        fullWidth
      >
        {query.isError ? "Warenkorb nicht verfügbar" : present ? "Im Warenkorb" : !available ? "Nicht verfügbar" : add.isPending ? "Wird hinzugefügt …" : "In den Warenkorb"}
      </Button>
      {full && !present && <Text variant="hint">Maximal zehn Produkte. Entferne zuerst ein Produkt im Warenkorb.</Text>}
      {add.isError && (
        <FieldError>{add.error instanceof ApiError ? add.error.message : ERROR_CART.SAVE.message}</FieldError>
      )}
    </div>
  );
}
