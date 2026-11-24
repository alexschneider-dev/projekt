import { AddToCart } from "@/components/cart/add-to-cart";
import type { CatalogProduct } from "@/lib/catalog/service";
import { formatPrice } from "@/lib/catalog/config";
import { productHref } from "@/lib/constants/routes";
import { AppLink } from "@/components/ui/app-link";
import { Text } from "@/components/ui/text";
import { ProductImage } from "./product-image";


export function ProductCard({ product }: { product: CatalogProduct }) {
  const offer = product.offers[0];
  return (
    <article className="group rounded-xl border bg-white p-3 transition-shadow hover:shadow-md">
      <AppLink
        href={productHref(product.slug)}
        variant="card"
      >
        <ProductImage image={product.image} />
        <div className="px-1 pb-2 pt-4">
          <Text variant="meta">{product.category.name}</Text>
          <h2 className="mt-1 text-base group-hover:text-primary">{product.name}</h2>
          <Text variant="description">
            {product.attributes
              .filter((item) => [
                "material",
                "color"
              ].includes(item.definition.key))
              .map((item) => item.textValue)
              .join(" · ")}
          </Text>
          <div className="mt-5 flex items-end justify-between gap-2">
            <Text className="text-xl font-semibold">{offer ? formatPrice(offer.priceCents) : "Kein Angebot"}</Text>
            <Text variant="meta">
              {product.offers.length} {product.offers.length === 1 ? "Angebot" : "Angebote"}
            </Text>
          </div>
        </div>
      </AppLink>
      {offer && (
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
      )}
    </article>
  );
}
