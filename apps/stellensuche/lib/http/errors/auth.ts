import { HTTP_STATUS } from "../status";
import type { ApiErrorDefinition } from "./types";


export const ERROR_AUTH = {
  UNAUTHORIZED: {
    status: HTTP_STATUS.UNAUTHORIZED,
    code: "UNAUTHORIZED",
    message: "Bitte melde dich an."
  },
  FORBIDDEN: {
    status: HTTP_STATUS.FORBIDDEN,
    code: "FORBIDDEN",
    message: "Du hast keine Berechtigung für diese Aktion."
  },
  LOGIN_FAILED: {
    status: HTTP_STATUS.UNAUTHORIZED,
    code: "LOGIN_FAILED",
    message: "Anmeldung nicht möglich. Prüfe deine Zugangsdaten oder versuche es später erneut."
  },
  LOGIN_UNAVAILABLE: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "LOGIN_UNAVAILABLE",
    message: "Die Anmeldung ist gerade nicht erreichbar. Bitte versuche es erneut."
  },
} as const satisfies Record<string, ApiErrorDefinition>;
