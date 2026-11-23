export const chairFilters = {
  material: {
    label: "Material",
    values: [
      "Holz",
      "Metall",
      "Kunststoff",
      "Polster"
    ],
  },
  color: {
    label: "Farbe",
    values: [
      "Natur",
      "Schwarz",
      "Weiß",
      "Grau",
      "Grün"
    ],
  },
  kind: {
    label: "Stuhltyp",
    values: [
      "Esszimmerstuhl",
      "Bürostuhl",
      "Loungestuhl",
      "Barhocker"
    ],
  },
} as const;

export const sortLabels = {
  newest: "Neueste zuerst",
  priceAsc: "Preis aufsteigend",
  priceDesc: "Preis absteigend",
} as const;

export const PAGE_SIZE = 24;
export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
