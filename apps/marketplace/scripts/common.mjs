import { ERRORS } from "./errors/index.mjs";


export function databaseGuard() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (url.searchParams.get("schema") !== "marketplace" || url.username !== "marketplace_app") {
    throw new Error(ERRORS.DATABASE);
  }
}

export function positiveInteger(value, fallback, maximum) {
  const number = Number(value ?? fallback);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) throw new Error(ERRORS.ARGUMENT);
  return number;
}

export function reportFailure(error) {
  console.error(Object.values(ERRORS).includes(error?.message) ? error.message : ERRORS.FAILED);
  process.exitCode = 1;
}
