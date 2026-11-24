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
