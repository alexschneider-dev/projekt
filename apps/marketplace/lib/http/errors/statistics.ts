import { HTTP_STATUS } from "../status";


export const ERROR_STATISTICS = {
  INITIALIZE: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "STATISTICS_INITIALIZE_FAILED",
    message: "Der anfängliche Zählerstand konnte nicht in Redis bereitgestellt werden."
  },
  PUBLISH: {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: "STATISTICS_PUBLISH_FAILED",
    message: "Die Aktualisierung der Produktstatistik konnte nicht angekündigt werden."
  }
};
