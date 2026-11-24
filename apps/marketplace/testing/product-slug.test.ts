import {
  expect,
  it
} from "vitest";
import { productSlug } from "@/lib/catalog/product-slug";
import type { CatalogProduct } from "@/lib/catalog/service";


it("bildet URLs aus ID, Farbe, Material und Maßen ohne Preis", () => {
  const attributes = [
    {
      definition: { key: "color" },
      textValue: "Natur"
    },
    {
      definition: { key: "material" },
      textValue: "Polster"
    },
    {
      definition: { key: "width" },
      numberValue: 45
    },
    {
      definition: { key: "seatHeight" },
      numberValue: 46
    }
  ] as unknown as CatalogProduct["attributes"];
  expect(productSlug({
    id: 995,
    attributes
  })).toBe("stuhl-995-natur-polster-45cm-breit-46cm-sitzhoehe");
});

it("normalisiert Umlaute und Sonderzeichen und überspringt fehlende Maße", () => {
  const attributes = [
    {
      definition: { key: "color" },
      textValue: "Weiß / Grün"
    },
    {
      definition: { key: "material" },
      textValue: "Hölzer & Metall"
    }
  ] as unknown as CatalogProduct["attributes"];
  expect(productSlug({
    id: 12,
    attributes
  })).toBe("stuhl-12-weiss-gruen-hoelzer-metall");
});
