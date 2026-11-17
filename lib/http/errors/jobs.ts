import { HTTP_STATUS } from "../status";
import type { ApiErrorDefinition } from "./types";


export const ERROR_JOBS = {
  SEARCH_LIMIT: {
    status: HTTP_STATUS.CONFLICT,
    code: "SEARCH_LIMIT",
    message: "Dein Konto erlaubt höchstens eine Suchgruppe. Du kannst die vorhandene Suche bearbeiten.",
  },
  IMPORT_STATUS_FAILED: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "JOB_IMPORT_STATUS_FAILED",
    message: "Der Importstatus konnte nicht geladen werden.",
  },
  IMPORT_FAILED: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "JOB_IMPORT_FAILED",
    message: "Der letzte Import ist fehlgeschlagen. Bereits gespeicherte Stellen bleiben erhalten.",
  },
  CSV_FILE: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_JOBS_CSV_FILE",
    message: "Bitte wähle eine nicht leere CSV-Datei mit höchstens 2 MB aus.",
  },
  CSV_CONTENT: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_JOBS_CSV_CONTENT",
    message: "Die CSV muss pro Zeile genau einen gültigen Stellenlink enthalten. Eine Kopfzeile URL oder Link ist erlaubt.",
  },
  CSV_LIMIT: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "JOBS_CSV_LIMIT",
    message: "Die CSV darf höchstens 10.000 Stellenlinks enthalten.",
  },
  INVALID_SEARCH_STATUS: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_SEARCH_STATUS",
    message: "Der Suchstatus muss true oder false sein.",
  },
  INVALID_TITLE: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_SEARCH_TITLE",
    message: "Bitte gib einen Titel mit 1 bis 200 Zeichen ein.",
  },
  INVALID_SEARCH_ID: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_SEARCH_ID",
    message: "Die Such-ID muss eine gültige positive Ganzzahl sein.",
  },
  INVALID_STATUS: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_STATUS",
    message: "Bitte wähle einen gültigen Stellenstatus: PENDING, BEWORBEN, NICHT_PASSEND oder AUSGELAUFEN.",
  },
  INVALID_ID: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_JOB_ID",
    message: "Die Stellen-ID muss eine gültige positive Ganzzahl sein.",
  },
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
  SEARCHES_LOAD_FAILED: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "JOB_SEARCHES_LOAD_FAILED",
    message: "Die Such-URLs konnten nicht geladen werden. Bitte versuche es erneut.",
  },
} as const satisfies Record<string, ApiErrorDefinition>;
