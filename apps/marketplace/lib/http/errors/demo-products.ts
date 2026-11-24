import { HTTP_STATUS } from "../status";


export const ERROR_DEMO_PRODUCTS = {
  MASTER_DATA: {
    status: HTTP_STATUS.CONFLICT,
    code: "DEMO_MASTER_DATA_MISSING",
    message: "Bitte lege zuerst aktive Materialien, Farben, Stuhltypen und Modellnamen für Stühle an.",
  },
  SAVE: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "DEMO_PRODUCTS_FAILED",
    message: "Die Demo-Produkte konnten nicht angelegt werden. Bitte versuche es erneut.",
  },
} as const;
