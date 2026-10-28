import { z } from "zod";
import { errorResponse } from "./error-response";
import {
  createApiError,
  ERROR_API
} from "./errors";


export type ParseResult<T> =
  | {
    ok: true;
    data: T
  }
  | {
    ok: false;
    response: Response
  };

export async function checkApiRequest<TSchema extends z.ZodType>(
  req: Request,
  schema: TSchema,
  isFormData = false,
): Promise<ParseResult<z.output<TSchema>>> {
  const contentType = req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== (isFormData ? "multipart/form-data" : "application/json")) {
    return {
      ok: false,
      response: errorResponse(createApiError(ERROR_API.INVALID_CONTENT_TYPE))
    };
  }

  let data: unknown;
  try {
    data = isFormData ? Object.fromEntries((await req.formData()).entries()) : await req.json();
  } catch {
    return {
      ok: false,
      response: errorResponse(createApiError(isFormData ? ERROR_API.INVALID_FORM_DATA : ERROR_API.INVALID_JSON))
    };
  }

  const parsed = await schema.safeParseAsync(data);
  if (!parsed.success) {
    return {
      ok: false,
      response: errorResponse(createApiError(
        ERROR_API.INVALID_BODY,
        z.flattenError(parsed.error)
      ))
    };
  }
  return {
    ok: true,
    data: parsed.data
  };
}
