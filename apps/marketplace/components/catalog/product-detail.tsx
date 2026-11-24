import { AddToCart } from "@/components/cart/add-to-cart";
import type { CatalogProduct } from "@/lib/catalog/service";
import { formatPrice } from "@/lib/catalog/config";
import { ROUTES } from "@/lib/constants/routes";
import { AppLink } from "@/components/ui/app-link";
import { Text } from "@/components/ui/text";
import PageWrapper from "@/components/ui/page/page-wrapper";
import { ProductImage } from "./product-image";


export function ProductDetail({ product }: { product: CatalogProduct }) {
  return (
    <PageWrapper>
      <AppLink href={ROUTES.home}>Alle Stühle</AppLink>
      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <ProductImage
          image={product.image}
          detail
        />
        <section>
          <Text variant="meta">{product.category.name}</Text>
          <h1 className="mt-3">{product.name}</h1>
          <Text variant="description">{product.description}</Text>
          <dl className="my-8 grid grid-cols-2 gap-x-6 gap-y-4 border-y py-6">
            {product.attributes.map((attribute) => (
              <div key={attribute.attributeId}>
                <dt className="text-sm text-muted-foreground">{attribute.definition.label}</dt>
                <dd className="mt-1 font-medium">
                  {attribute.textValue ?? attribute.numberValue ?? (attribute.booleanValue ? "Ja" : "Nein")}{" "}
                  {attribute.definition.unit}
                </dd>
              </div>
            ))}
          </dl>
          <h2>Angebote vergleichen</h2>
          <div className="mt-4 space-y-3">
            {product.offers.map((offer) => (
              <div
                key={offer.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"
              >
                <div>
                  <Text>{offer.seller.name}</Text>
                  <Text variant="meta">
                    {offer.stock > 0 ? `Lieferzeit: ${offer.deliveryDays} Werktage` : "Derzeit ausverkauft"}
                  </Text>
                </div>
                <div className="space-y-3">
                  <Text className="text-xl font-semibold">{formatPrice(offer.priceCents)}</Text>
                  <AddToCart
                    item={{
                      productId: product.id,
                      offer: {
                        ...offer,
                        product
                      }
                    }}
                    available={offer.stock > 0}
                  />
                </div>
              </div>
            ))}
            {!product.offers.length && <Text variant="description">Aktuell sind keine Angebote verfügbar.</Text>}
          </div>
          <Text variant="hint">Demo-Angebote – ein Kauf ist derzeit nicht möglich.</Text>
        </section>
      </div>
    </PageWrapper>
  );
}
