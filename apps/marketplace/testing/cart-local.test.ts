// @vitest-environment jsdom
import {
  beforeEach,
  expect,
  it
} from "vitest";
import {
  addLocalItem,
  removeLocalItem,
  readLocalCart,
  parseLocalCart,
  clearSyncedCart,
  CART_STORAGE_KEY
} from "@/lib/cart/local";


function item(productId: number) {
  return {
    productId,
    offer: {
      id: `offer-${productId}`,
      priceCents: 100,
      stock: 5,
      active: true,
      seller: { name: "Demo" },
      product: {
        name: "Stuhl",
        slug: `stuhl-${productId}`,
        published: true,
        image: null
      }
    }
  };
}

beforeEach(() => localStorage.clear());

it("begrenzt auf zehn verschiedene Produkte und erlaubt Entfernen", () => {
  for (let id = 1; id <= 10; id++) addLocalItem(item(id));
  expect(addLocalItem(item(1)).items).toHaveLength(10);
  expect(() => addLocalItem(item(11))).toThrow();
  removeLocalItem(1);
  expect(addLocalItem(item(11)).items).toHaveLength(10);
});

it("ignoriert beschädigte Browserdaten", () => {
  expect(parseLocalCart("kein JSON").items).toEqual([]);
  expect(parseLocalCart('[{"productId":1}]').items).toEqual([]);
});

it("bewahrt Änderungen eines anderen Tabs während der Synchronisierung", () => {
  addLocalItem(item(1));
  const snapshot = readLocalCart();
  addLocalItem(item(2));
  clearSyncedCart(snapshot);
  expect(parseLocalCart(localStorage.getItem(CART_STORAGE_KEY)).items).toHaveLength(2);
});
