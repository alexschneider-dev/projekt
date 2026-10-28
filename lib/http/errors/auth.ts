import type { ApiErrorDefinition } from "./types";


export const ERROR_AUTH = {
  UNAUTHORIZED: {
    status: 401,
    code: "UNAUTHORIZED",
    message: "Bitte melde dich an."
  },
  FORBIDDEN: {
    status: 403,
    code: "FORBIDDEN",
    message: "Du hast keine Berechtigung für diese Aktion."
  },
  LOGIN_FAILED: {
    status: 401,
    code: "LOGIN_FAILED",
    message: "Anmeldung nicht möglich. Prüfe deine Zugangsdaten oder versuche es später erneut."
  },
  LOGIN_UNAVAILABLE: {
    status: 503,
    code: "LOGIN_UNAVAILABLE",
    message: "Die Anmeldung ist gerade nicht erreichbar. Bitte versuche es erneut."
  },
} as const satisfies Record<string, ApiErrorDefinition>;
