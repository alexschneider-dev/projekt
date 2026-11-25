export const STATISTICS_CHANNEL: "marketplace:statistics:v1";
export const STATISTICS_KEY: "marketplace:statistics:snapshot:v1";
export const STATISTICS_EVENT: "statistics";
export const STATISTICS_NAMESPACE: "/statistics";

export type StatisticsSnapshot = {
  version: 1;
  available: true;
  products: number;
  sellers: number;
  revision: string;
} | {
  version: 1;
  available: false;
  products: null;
  sellers: null;
};

export function isStatisticsSnapshot(value: unknown): value is StatisticsSnapshot;
