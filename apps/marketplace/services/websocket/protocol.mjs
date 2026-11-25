export const STATISTICS_CHANNEL = "marketplace:statistics:v1";
export const STATISTICS_KEY = "marketplace:statistics:snapshot:v1";
export const STATISTICS_EVENT = "statistics";
export const STATISTICS_NAMESPACE = "/statistics";

export function isStatisticsSnapshot(value) {
  return value !== null && typeof value === "object" && value.version === 1
    && typeof value.available === "boolean"
    && (value.available
      ? Number.isSafeInteger(value.products) && value.products >= 0
        && Number.isSafeInteger(value.sellers) && value.sellers >= 0
        && typeof value.revision === "string" && /^[1-9][0-9]{0,39}$/.test(value.revision)
      : value.products === null && value.sellers === null);
}
