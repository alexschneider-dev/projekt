// @vitest-environment jsdom
import { createElement } from "react";
import {
  afterEach,
  expect,
  it,
  vi
} from "vitest";
import {
  cleanup,
  render,
  screen
} from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query";
import { Catalog } from "@/components/catalog/catalog";
import { catalogSchema } from "@/lib/schemas/catalog";


vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/catalog/filters", () => ({ Filters: () => null }));
vi.mock("@/components/catalog/product-card", () => ({ ProductCard: () => null }));
afterEach(cleanup);

it.each([
  1000,
  24,
  0
])("zeigt %i gefilterte Treffer unabhängig von den geladenen Produkten", (filteredTotal) => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  render(createElement(QueryClientProvider, { client }, createElement(Catalog, {
    filters: catalogSchema.parse({ material: "Holz" }),
    options: null,
    initialData: {
      items: [],
      page: 1,
      hasNext: false,
      total: 1000,
      filteredTotal
    }
  })));
  expect(screen.getByRole("status").textContent).toBe(`${filteredTotal.toLocaleString("de-DE")} von 1.000 Produkten`);
});
