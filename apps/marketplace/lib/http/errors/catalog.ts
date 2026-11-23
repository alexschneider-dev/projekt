import { HTTP_STATUS } from "../status";


export const ERROR_CATALOG = {
  FILTER: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "CATALOG_FILTER",
    message: "Bitte prüfe die Filterwerte.",
  },
  PRICE: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "CATALOG_PRICE",
    message: "Der Mindestpreis darf den Höchstpreis nicht überschreiten.",
  },
  NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "CATALOG_NOT_FOUND",
    message: "Dieses Produkt ist nicht verfügbar.",
  },
  UNAVAILABLE: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "CATALOG_UNAVAILABLE",
    message: "Der Katalog ist momentan nicht erreichbar. Bitte versuche es erneut.",
  },
} as const;
