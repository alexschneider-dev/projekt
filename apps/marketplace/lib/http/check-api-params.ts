import { z } from "zod";
import type { ParseResult } from "./check-api-request";
import { errorResponse } from "./error-response";
import {
  createApiError,
  ERROR_API
} from "./errors";


export async function checkApiParams<TSchema extends z.ZodType>(
  params: unknown,
  schema: TSchema,
): Promise<ParseResult<z.output<TSchema>>> {
  const parsed = await schema.safeParseAsync(params);

  if (!parsed.success) {
    return {
      ok: false,
      response: errorResponse(createApiError(ERROR_API.INVALID_PARAMS), {
        source: "params",
        issues: parsed.error.issues,
      }),
    };
  }

  return {
    ok: true,
    data: parsed.data,
  };
}
