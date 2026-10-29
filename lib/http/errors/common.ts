import { HTTP_STATUS } from "../status";
import type { ApiErrorDefinition } from "./types";


export const ERROR_API = {
  INVALID_CONTENT_TYPE: {
    status: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
    code: "INVALID_CONTENT_TYPE",
    message: "Der Inhaltstyp der Anfrage wird nicht unterstützt."
  },
  INVALID_JSON: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_JSON",
    message: "Die Anfrage enthält ungültiges JSON."
  },
  INVALID_FORM_DATA: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_FORM_DATA",
    message: "Die Formulardaten sind ungültig."
  },
  INVALID_BODY: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_BODY",
    message: "Bitte prüfe deine Eingaben."
  },
  INVALID_QUERY: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_QUERY",
    message: "Die Abfrageparameter sind ungültig."
  },
  INVALID_PARAMS: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "INVALID_PARAMS",
    message: "Die Pfadparameter sind ungültig."
  },
  INTERNAL_SERVER_ERROR: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: "INTERNAL_SERVER_ERROR",
    message: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut."
  },
  NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Der Eintrag wurde nicht gefunden."
  },
  NETWORK_ERROR: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "NETWORK_ERROR",
    message: "Der Server ist gerade nicht erreichbar. Bitte versuche es erneut."
  },
  INVALID_RESPONSE: {
    status: HTTP_STATUS.BAD_GATEWAY,
    code: "INVALID_RESPONSE",
    message: "Der Server hat eine ungültige Antwort gesendet."
  },
  UNIQUE_CONSTRAINT_ERROR: {
    status: HTTP_STATUS.CONFLICT,
    code: "UNIQUE_CONSTRAINT_ERROR",
    message: "Ein Eintrag mit diesen Daten existiert bereits."
  },
  TRANSACTION_CONFLICT: {
    status: HTTP_STATUS.CONFLICT,
    code: "TRANSACTION_CONFLICT",
    message: "Die Daten wurden zwischenzeitlich geändert. Bitte versuche es erneut."
  },
} as const satisfies Record<string, ApiErrorDefinition>;
