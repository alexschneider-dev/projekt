import { HTTP_STATUS } from "../status";


export const ERROR_CART = {
  STORAGE: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "CART_STORAGE",
    message: "Der Warenkorb konnte nicht im Browser gespeichert werden. Bitte erlaube lokalen Speicher oder melde dich an.",
  },
  INVALID: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "CART_INVALID",
    message: "Bitte wähle ein gültiges Angebot aus.",
  },
  FULL: {
    status: HTTP_STATUS.CONFLICT,
    code: "CART_FULL",
    message: "Dein Warenkorb enthält bereits zehn Produkte. Entferne zuerst ein Produkt.",
  },
  UNAVAILABLE: {
    status: HTTP_STATUS.CONFLICT,
    code: "CART_OFFER_UNAVAILABLE",
    message: "Dieses Angebot ist nicht mehr verfügbar.",
  },
  LOAD: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "CART_LOAD",
    message: "Dein Warenkorb konnte nicht geladen werden. Bitte versuche es erneut.",
  },
  SAVE: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "CART_SAVE",
    message: "Dein Warenkorb konnte nicht geändert werden. Bitte versuche es erneut.",
  },
} as const;
