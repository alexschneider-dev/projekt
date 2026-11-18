import { ApiError } from "../api-error";
import type { ApiErrorDefinition } from "./types";


export { HTTP_STATUS } from "../status";
export { ERROR_API } from "./common";
export { ERROR_AUTH } from "./auth";
export type { ApiErrorDefinition } from "./types";

export function createApiError<TDetails = unknown>(error: ApiErrorDefinition, details?: TDetails): ApiError<TDetails> {
  return new ApiError(error.status, error.code, error.message, details);
}
