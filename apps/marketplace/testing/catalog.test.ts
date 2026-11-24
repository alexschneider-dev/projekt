import {
  describe,
  expect,
  it
} from "vitest";
import {
  catalogSchema,
  catalogQuery
} from "@/lib/schemas/catalog";
import {
  hasRole,
  CUSTOMER,
  SELLER,
  SUPER_ADMIN
} from "@/lib/auth/roles";


describe("Katalogfilter", () => {
  it("begrenzt Preise, Seitentiefe und Länge der Eigenschaften", () => {
    for (const values of [
      { min: -1 },
      { page: 1001 },
      {
        min: 200,
        max: 100,
      },
      { color: "x".repeat(81) },
      { q: "x".repeat(81) },
    ]) {
      expect(catalogSchema.safeParse(values).success).toBe(false);
    }
  });
  it("erhält Filter beim Teilen einer URL", () => {
    const filters = catalogSchema.parse({
      material: "Holz",
      min: "120",
      sort: "priceAsc",
      page: "2",
    });
    expect(catalogSchema.parse(Object.fromEntries(new URLSearchParams(catalogQuery(filters))))).toEqual(filters);
  });
});

describe("Rollenhierarchie", () => {
  it("verweigert Verkäufer- und Verwaltungsrechte für Kunden", () => {
    expect(hasRole(CUSTOMER, SELLER)).toBe(false);
    expect(hasRole(CUSTOMER, SUPER_ADMIN)).toBe(false);
    expect(hasRole(SELLER, SUPER_ADMIN)).toBe(false);
    expect(hasRole(SELLER, CUSTOMER)).toBe(true);
    expect(hasRole(SUPER_ADMIN, SELLER)).toBe(true);
    expect(hasRole("ADMIN", CUSTOMER)).toBe(false);
  });
});
