import { JOB_ERRORS } from "./index.mjs";


function identifier(value) {
  return typeof value === "string" && /^[A-Za-z0-9_]{1,100}$/.test(value) ? value : undefined;
}

export function jobErrorLog(error, context = {}) {
  const causes = [];
  let current = error;
  // Keine ungefilterten Meldungen, Verbindungsadressen oder Antwortinhalte protokollieren.
  for (let depth = 0; current && depth < 5; depth += 1) {
    causes.push({
      type: identifier(current.name),
      code: identifier(current.code ?? current.errorCode),
    });
    current = current.cause;
  }

  return JSON.stringify({
    message: Object.values(JOB_ERRORS).includes(error?.message) ? error.message : JOB_ERRORS.failed,
    ...context,
    httpStatus: Number.isInteger(error?.httpStatus) ? error.httpStatus : undefined,
    causes,
  });
}
