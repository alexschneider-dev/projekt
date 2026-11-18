import { HTTP_STATUS } from "../status";
import type { ApiErrorDefinition } from "./types";


export const ERROR_OBSERVABILITY = {
  METRICS_LISTENER: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "METRICS_LISTENER_FAILED",
    message: "Der Metrik-Endpunkt konnte nicht gestartet werden.",
  },
  REQUEST_FAILED: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "REQUEST_FAILED",
    message: "Eine serverseitige Anfrage ist fehlgeschlagen.",
  },
} as const satisfies Record<string, ApiErrorDefinition>;
