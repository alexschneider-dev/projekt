import type { ApiErrorDefinition } from "./types";


export const ERROR_API = {
  INVALID_CONTENT_TYPE: {
    status: 415,
    code: "INVALID_CONTENT_TYPE",
    message: "Der Inhaltstyp der Anfrage wird nicht unterstützt."
  },
  INVALID_JSON: {
    status: 400,
    code: "INVALID_JSON",
    message: "Die Anfrage enthält ungültiges JSON."
  },
  INVALID_FORM_DATA: {
    status: 400,
    code: "INVALID_FORM_DATA",
    message: "Die Formulardaten sind ungültig."
  },
  INVALID_BODY: {
    status: 400,
    code: "INVALID_BODY",
    message: "Bitte prüfe deine Eingaben."
  },
  INVALID_QUERY: {
    status: 400,
    code: "INVALID_QUERY",
    message: "Die Abfrageparameter sind ungültig."
  },
  INVALID_PARAMS: {
    status: 400,
    code: "INVALID_PARAMS",
    message: "Die Pfadparameter sind ungültig."
  },
  INTERNAL_SERVER_ERROR: {
    status: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut."
  },
  NOT_FOUND: {
    status: 404,
    code: "NOT_FOUND",
    message: "Der Eintrag wurde nicht gefunden."
  },
  NETWORK_ERROR: {
    status: 503,
    code: "NETWORK_ERROR",
    message: "Der Server ist gerade nicht erreichbar. Bitte versuche es erneut."
  },
  INVALID_RESPONSE: {
    status: 502,
    code: "INVALID_RESPONSE",
    message: "Der Server hat eine ungültige Antwort gesendet."
  },
  UNIQUE_CONSTRAINT_ERROR: {
    status: 409,
    code: "UNIQUE_CONSTRAINT_ERROR",
    message: "Ein Eintrag mit diesen Daten existiert bereits."
  },
  TRANSACTION_CONFLICT: {
    status: 409,
    code: "TRANSACTION_CONFLICT",
    message: "Die Daten wurden zwischenzeitlich geändert. Bitte versuche es erneut."
  },
} as const satisfies Record<string, ApiErrorDefinition>;
