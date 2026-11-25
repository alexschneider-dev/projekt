import { HTTP_STATUS } from "../status";


export const ERROR_OFFERS = {
  INVALID: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "OFFER_AVAILABILITY_INVALID",
    message: "Bitte gib eine gültige Angebots-ID, Aktivierung und einen ganzzahligen Bestand an."
  },
  NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "OFFER_NOT_FOUND",
    message: "Das Angebot wurde nicht gefunden."
  }
};
