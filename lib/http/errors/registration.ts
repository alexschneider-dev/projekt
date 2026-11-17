import { HTTP_STATUS } from "../status";


export const ERROR_REGISTRATION = {
  RATE_LIMIT: {
    status: HTTP_STATUS.TOO_MANY_REQUESTS,
    code: "REGISTRATION_RATE_LIMIT",
    message: "Zu viele Versuche. Bitte versuche es in einer Stunde erneut.",
  },
  INVALID_TOKEN: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_VERIFICATION_TOKEN",
    message: "Der Bestätigungslink ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.",
  },
  MAIL_UNAVAILABLE: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "VERIFICATION_MAIL_UNAVAILABLE",
    message: "Die Bestätigungs-E-Mail konnte nicht versendet werden. Bitte versuche es später erneut.",
  },
  FAILED: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "REGISTRATION_FAILED",
    message: "Die Registrierung konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
  },
} as const;
