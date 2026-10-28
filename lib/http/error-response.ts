import { Prisma } from "@prisma/client";
import { ApiError } from "./api-error";
import {
  createApiError,
  ERROR_API
} from "./errors";


export function errorResponse(error: unknown): Response {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") error = createApiError(ERROR_API.UNIQUE_CONSTRAINT_ERROR);
    else if (error.code === "P2034") error = createApiError(ERROR_API.TRANSACTION_CONFLICT);
    else if (error.code === "P2025") error = createApiError(ERROR_API.NOT_FOUND);
  }

  if (!(error instanceof ApiError)) {
    console.error(
      ERROR_API.INTERNAL_SERVER_ERROR,
      error
    );
    error = createApiError(ERROR_API.INTERNAL_SERVER_ERROR);
  }

  const apiError = error as ApiError;
  return Response.json(
    {
      error: apiError.message,
      code: apiError.code,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
    },
    { status: apiError.status }
  );
}
