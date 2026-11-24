import { HTTP_STATUS } from "../status";


export const ERROR_MASTER_DATA = {
  INVALID: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "MASTER_DATA_INVALID",
    message: "Bitte prüfe Kategorie, Bezeichnung und Auswahl.",
  },
  NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "MASTER_DATA_NOT_FOUND",
    message: "Dieser Stammdateneintrag oder seine Kategorie ist nicht verfügbar.",
  },
  LOAD: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "MASTER_DATA_LOAD",
    message: "Die Stammdaten konnten nicht geladen werden. Bitte versuche es erneut.",
  },
  SAVE: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "MASTER_DATA_SAVE",
    message: "Die Stammdaten konnten nicht gespeichert werden.",
  },
} as const;
