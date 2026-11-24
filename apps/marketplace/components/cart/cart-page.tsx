"use client";

import { useCart } from "@/hooks/cart/use-cart";
import { CART_LIMIT } from "@/lib/cart/config";
import { ERROR_CART } from "@/lib/http/errors/cart";
import { ApiError } from "@/lib/http/api-error";
import {
  ROUTES,
  productHref
} from "@/lib/constants/routes";
import { formatPrice } from "@/lib/catalog/config";
import { ProductImage } from "@/components/catalog/product-image";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import PageWrapper from "@/components/ui/page/page-wrapper";


export function CartPage() {
  const {
    query,
    remove,
    authenticated,
    skipped
  } = useCart();

  return (
    <PageWrapper>
      <AppLink href={ROUTES.home}>Weiter stöbern</AppLink>
      <h1 className="mt-6">Dein Warenkorb</h1>
      <Text variant="intro">
        Bis zu zehn verschiedene Produkte, jeweils einmal. Ein Kauf ist noch nicht möglich.
      </Text>
      {!authenticated && (
        <Text variant="hint">
          Dein Warenkorb wird nur in diesem Browser gespeichert. <AppLink href={ROUTES.login}>Anmelden</AppLink>,
          um ihn mit deinem Konto zu synchronisieren.
        </Text>
      )}
      {skipped > 0 && (
        <Text role="status">
          {skipped} Angebote konnten nicht übernommen werden: nicht mehr verfügbar oder die Grenze von zehn Produkten
          ist erreicht. Bereits gespeicherte Produkte haben Vorrang.
        </Text>
      )}
      {query.isPending && <Text role="status">Warenkorb wird geladen …</Text>}
      {query.isError && (
        <div className="space-y-4">
          <FieldError>{query.error instanceof ApiError ? query.error.message : ERROR_CART.LOAD.message}</FieldError>
          <Button onClick={() => query.refetch()}>Erneut laden</Button>
        </div>
      )}
      {remove.isError && (
        <FieldError>{remove.error instanceof ApiError ? remove.error.message : ERROR_CART.SAVE.message}</FieldError>
      )}
      {query.data && (
        <div className="space-y-6">
          <Text role="status">{query.data.items.length} von {CART_LIMIT} Produkten</Text>
          {!query.data.items.length && <Text variant="description">Dein Warenkorb ist leer.</Text>}
          <ul className="space-y-4">
            {query.data.items.map(({
              productId,
              offer
            }) => (
              <li
                key={productId}
                className="flex flex-wrap items-center gap-5 rounded-xl border bg-white p-5"
              >
                <div className="w-24 shrink-0">
                  <ProductImage
                    image={offer.product.image}
                    compact
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <AppLink href={productHref(offer.product.slug)}>{offer.product.name}</AppLink>
                  <Text variant="meta">Verkäufer: {offer.seller.name}</Text>
                  {(!offer.active || offer.stock < 1 || !offer.product.published) && (
                    <Text variant="hint">Dieses Angebot ist aktuell nicht verfügbar.</Text>
                  )}
                  <Text>{formatPrice(offer.priceCents)}</Text>
                </div>
                <Button
                  variant="outline"
                  disabled={remove.isPending}
                  aria-label={`${offer.product.name} entfernen`}
                  onClick={() => remove.mutate(productId)}
                >
                  Entfernen
                </Button>
              </li>
            ))}
          </ul>
          {query.data.items.length > 0 && (
            <Text className="text-xl font-semibold">Gesamt: {formatPrice(query.data.totalCents)}</Text>
          )}
        </div>
      )}
    </PageWrapper>
  );
}
