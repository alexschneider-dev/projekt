import { ROUTES as appRoutes } from "@/lib/constants/routes";
import { withBasePath } from "@/lib/constants/base-path";


export const ROUTES = Object.fromEntries(Object.entries(appRoutes).map(([
  key,
  value
]) => [
    key,
    key === "grafana" || key === "telemetryCollect" ? value : key === "home" ? "/stellensuche" : withBasePath(value),
  ])) as { [Key in keyof typeof appRoutes]: string };
export const jobSearchHref = (id: number) => `${ROUTES.jobSearches}/${id}`;
export const jobSearchApiHref = (id: number) => `${ROUTES.jobSearchesApi}/${id}`;
