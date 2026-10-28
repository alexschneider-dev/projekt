import { z } from "zod";
import type { ParseResult } from "./check-api-request";
import { errorResponse } from "./error-response";
import {
  createApiError,
  ERROR_API
} from "./errors";


export async function checkApiQuery<TSchema extends z.ZodType>(
  req: Request,
  schema: TSchema,
): Promise<ParseResult<z.output<TSchema>>> {
  const parsed = await schema.safeParseAsync(Object.fromEntries(new URL(req.url).searchParams.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      response: errorResponse(createApiError(
        ERROR_API.INVALID_QUERY,
        z.flattenError(parsed.error)
      ))
    };
  }
  return {
    ok: true,
    data: parsed.data
  };
}
