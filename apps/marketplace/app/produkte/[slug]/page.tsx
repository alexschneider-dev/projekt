import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getProduct } from "@/lib/catalog/service";
import { productParamsSchema } from "@/lib/schemas/catalog";
import { ProductDetail } from "@/components/catalog/product-detail";
import { productHref } from "@/lib/constants/routes";
import { withBasePath } from "@/lib/constants/base-path";


const load = cache(async (slug: string) => {
  const parsed = productParamsSchema.safeParse({ slug });
  if (!parsed.success) notFound();
  const product = await getProduct(parsed.data.slug);
  if (!product) notFound();
  return product;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await load((await params).slug);
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    alternates: { canonical: withBasePath(productHref(product.slug)) },
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      ...(product.image ? { images: [product.image.largeUrl] } : {}),
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  return <ProductDetail product={await load((await params).slug)} />;
}
