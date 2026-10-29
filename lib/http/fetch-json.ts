import { ApiError } from "./api-error";
import {
  createApiError,
  ERROR_API,
  HTTP_STATUS,
} from "./errors";


export type FetchJsonOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export async function fetchJson<T>(input: RequestInfo | URL, options: FetchJsonOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const body = options.body === undefined
    ? undefined
    : isFormData ? options.body as FormData : JSON.stringify(options.body);
  let response: Response;

  try {
    response = await fetch(input, {
      method: options.method ?? "GET",
      ...(body === undefined ? {} : { body }),
      ...(isFormData || body === undefined ? {} : { headers: { "Content-Type": "application/json" } }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;

    throw createApiError(ERROR_API.NETWORK_ERROR);
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const data = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};

    throw new ApiError(
      response.status,
      typeof data.code === "string" ? data.code : ERROR_API.INTERNAL_SERVER_ERROR.code,
      typeof data.error === "string" ? data.error : ERROR_API.INTERNAL_SERVER_ERROR.message,
      data.details
    );
  }

  if (response.status === HTTP_STATUS.NO_CONTENT || response.status === HTTP_STATUS.RESET_CONTENT) return undefined as T;

  try {
    return await response.json() as T;
  } catch {
    throw createApiError(ERROR_API.INVALID_RESPONSE);
  }
}
