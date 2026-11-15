import { HTTP_STATUS } from "../status";
import type { ApiErrorDefinition } from "./types";


export const ERROR_JOBS = {
  INVALID_SEARCH_URL: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_SEARCH_URL",
    message: "Bitte gib eine gültige HTTPS-Such-URL der unterstützten Jobbörse ein.",
  },
  INVALID_PAGE: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_PAGE",
    message: "Die Seitenzahl muss eine positive ganze Zahl sein.",
  },
  SAVE_FAILED: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "JOB_SEARCH_SAVE_FAILED",
    message: "Die Such-URL konnte nicht gespeichert werden. Bitte versuche es erneut.",
  },
  LOAD_FAILED: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "JOBS_LOAD_FAILED",
    message: "Die Stellen konnten nicht geladen werden. Bitte versuche es erneut.",
  },
} as const satisfies Record<string, ApiErrorDefinition>;
