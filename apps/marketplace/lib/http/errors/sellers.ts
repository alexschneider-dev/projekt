import { HTTP_STATUS } from "../status";


export const ERROR_SELLERS = {
  INVALID: {
    status: HTTP_STATUS.BAD_REQUEST,
    code: "SELLER_STATUS_INVALID",
    message: "Bitte gib eine gültige Verkäufer-ID und einen Aktivierungsstatus an."
  },
  NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    code: "SELLER_NOT_FOUND",
    message: "Das Verkäuferkonto wurde nicht gefunden."
  }
};
