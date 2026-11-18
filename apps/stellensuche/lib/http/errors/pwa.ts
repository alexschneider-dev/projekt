import { HTTP_STATUS } from "../status";


export const ERROR_PWA = {
  REGISTRATION_FAILED: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "PWA_REGISTRATION_FAILED",
    message: "Die Offline-Hinweisseite konnte nicht eingerichtet werden.",
  },
  INSTALLATION_FAILED: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "PWA_INSTALLATION_FAILED",
    message: "Die App konnte nicht installiert werden. Versuche es über das Browsermenü erneut.",
  },
} as const;
