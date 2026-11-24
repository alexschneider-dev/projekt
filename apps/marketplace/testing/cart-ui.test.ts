// @vitest-environment jsdom
import { createElement } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query";
import { CartProvider } from "@/hooks/cart/use-cart";
import { CART_STORAGE_KEY } from "@/lib/cart/local";
import { AddToCart } from "@/components/cart/add-to-cart";
import { CartPage } from "@/components/cart/cart-page";
import type { Cart } from "@/lib/cart/service";


const mocks = vi.hoisted(() => ({
  authenticated: true,
  fetchJson: vi.fn()
}));
vi.mock("@/lib/http/fetch-json", () => ({ fetchJson: mocks.fetchJson }));
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: mocks.authenticated ? { user: { id: "kunde-1" } } : null,
    status: mocks.authenticated ? "authenticated" : "unauthenticated",
  })
}));
vi.mock("next/link", () => ({ default: (props: Record<string, unknown>) => createElement("a", props) }));

function cart(count: number): Cart {
  return {
    limit: 10,
    totalCents: count * 7900,
    items: Array.from({ length: count }, (_, index) => ({
      productId: index + 1,
      offer: {
        id: `offer-${index + 1}`,
        priceCents: 7900,
        stock: 5,
        active: true,
        seller: { name: "Wohnstudio" },
        product: {
          name: `Stuhl ${index + 1}`,
          slug: `stuhl-${index + 1}`,
          published: true,
          image: null
        },
      },
    })),
  };
}
function mount(element: ReturnType<typeof createElement>) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return render(element, {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client }, createElement(CartProvider, null, children))
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.authenticated = true;
  mocks.fetchJson.mockResolvedValue(cart(0));
});
afterEach(cleanup);

describe("Einfacher Warenkorb", () => {
  it("speichert für Gäste lokal ohne API", async () => {
    mocks.authenticated = false;
    mount(createElement(AddToCart, {
      item: cart(1).items[0]!,
      available: true
    }));
    await waitFor(() => expect((screen.getByRole("button", { name: "In den Warenkorb" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: "In den Warenkorb" }));
    await screen.findByRole("button", { name: "Im Warenkorb" });
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toHaveLength(1);
    expect(mocks.fetchJson).not.toHaveBeenCalled();
  });

  it("sperrt Hinzufügen bei zehn Produkten", async () => {
    mocks.fetchJson.mockResolvedValue(cart(10));
    mount(createElement(AddToCart, {
      item: cart(11).items[10]!,
      available: true
    }));
    await screen.findByText("Maximal zehn Produkte. Entferne zuerst ein Produkt im Warenkorb.");
    expect((screen.getByRole("button", { name: "In den Warenkorb" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sendet nur die Angebots-ID und zeigt den hinzugefügten Zustand", async () => {
    let current = cart(0);
    mocks.fetchJson.mockImplementation(async (_url: string, options?: { method?: string }) => {
      if (options?.method === "POST") current = cart(1);
      return current;
    });
    mount(createElement(AddToCart, {
      item: cart(1).items[0]!,
      available: true
    }));
    await waitFor(() => expect((screen.getByRole("button", { name: "In den Warenkorb" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: "In den Warenkorb" }));
    await screen.findByRole("button", { name: "Im Warenkorb" });
    expect(mocks.fetchJson).toHaveBeenCalledWith("/api/cart", {
      method: "POST",
      body: { offerId: "offer-1" }
    });
  });

  it("bietet bereits enthaltene Produkte nicht erneut an", async () => {
    mocks.fetchJson.mockResolvedValue(cart(1));
    mount(createElement(AddToCart, {
      item: cart(1).items[0]!,
      available: true
    }));
    const button = await screen.findByRole("button", { name: "Im Warenkorb" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("entfernt ein Produkt und zeigt den leeren Warenkorb", async () => {
    let current = cart(1);
    mocks.fetchJson.mockImplementation(async (_url: string, options?: { method?: string }) => {
      if (options?.method === "DELETE") current = cart(0);
      return current;
    });
    mount(createElement(CartPage));
    await screen.findByText("Verkäufer: Wohnstudio");
    await userEvent.click(screen.getByRole("button", { name: "Stuhl 1 entfernen" }));
    await screen.findByText("Dein Warenkorb ist leer.");
    await waitFor(() => expect(mocks.fetchJson).toHaveBeenCalledWith("/api/cart/1", { method: "DELETE" }));
    expect(screen.queryByRole("button", { name: /entfernen/i })).toBeNull();
  });
});

it("synchronisiert lokale Angebote bei Anmeldung und leert den Gast-Speicher", async () => {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart(1).items));
  mocks.fetchJson.mockResolvedValue({
    cart: cart(1),
    skipped: []
  });
  mount(createElement(CartPage));
  await screen.findByText("Verkäufer: Wohnstudio");
  expect(mocks.fetchJson).toHaveBeenCalledWith("/api/cart/sync", expect.objectContaining({
    method: "POST",
    body: { offerIds: ["offer-1"] }
  }));
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toEqual([]);
});

it("behält lokale Daten bei fehlgeschlagener Synchronisierung", async () => {
  const saved = JSON.stringify(cart(1).items);
  localStorage.setItem(CART_STORAGE_KEY, saved);
  mocks.fetchJson.mockRejectedValue(new Error("Testfehler"));
  mount(createElement(CartPage));
  await screen.findByRole("button", { name: "Erneut laden" });
  expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(saved);
});

it("entfernt Gästeprodukte ohne API", async () => {
  mocks.authenticated = false;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart(1).items));
  mount(createElement(CartPage));
  await userEvent.click(await screen.findByRole("button", { name: "Stuhl 1 entfernen" }));
  await screen.findByText("Dein Warenkorb ist leer.");
  expect(mocks.fetchJson).not.toHaveBeenCalled();
});

it("synchronisiert beim Wechsel von Gast zu Kunde und zeigt nach Abmeldung keine Kontodaten", async () => {
  mocks.authenticated = false;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart(1).items));
  const view = mount(createElement(CartPage));
  await screen.findByRole("button", { name: "Stuhl 1 entfernen" });
  expect(mocks.fetchJson).not.toHaveBeenCalled();

  mocks.authenticated = true;
  mocks.fetchJson.mockResolvedValue({
    cart: cart(2),
    skipped: []
  });
  view.rerender(createElement(CartPage));
  await screen.findByRole("button", { name: "Stuhl 2 entfernen" });
  expect(mocks.fetchJson).toHaveBeenCalledTimes(1);

  mocks.authenticated = false;
  view.rerender(createElement(CartPage));
  await screen.findByText("Dein Warenkorb ist leer.");
  expect(screen.queryByRole("button", { name: "Stuhl 2 entfernen" })).toBeNull();
});
