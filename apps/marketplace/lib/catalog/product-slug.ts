import type { CatalogProduct } from "./service";


function segment(value: string) {
  return value.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 24).replace(/-$/, "");
}

export function productSlug(product: Pick<CatalogProduct, "id" | "attributes">) {
  const attributes = new Map(product.attributes.map(attribute => [
    attribute.definition.key,
    attribute
  ]));
  const color = segment(attributes.get("color")?.textValue ?? "");
  const material = segment(attributes.get("material")?.textValue ?? "");
  const width = attributes.get("width")?.numberValue;
  const height = attributes.get("seatHeight")?.numberValue;

  return [
    `stuhl-${product.id}`,
    color,
    material,
    width == null ? "" : `${segment(String(width))}cm-breit`,
    height == null ? "" : `${segment(String(height))}cm-sitzhoehe`
  ].filter(Boolean).join("-").slice(0, 120).replace(/-$/, "");
}
