import {
  createApiError,
  ERROR_API
} from "./errors";


export function checkOrigin(request: Request) {
  const expected = new URL(process.env.NEXTAUTH_URL ?? request.url).origin;
  if (request.headers.get("origin") !== expected) throw createApiError(ERROR_API.ORIGIN);
}
