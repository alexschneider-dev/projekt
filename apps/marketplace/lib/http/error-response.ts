import { Prisma } from "@prisma/client";
import type { core } from "zod";
import { log } from "../observability/logger";
import { HTTP_STATUS } from "./status";
import { ApiError } from "./api-error";
import {
  createApiError,
  ERROR_API,
} from "./errors";


type ValidationContext = {
  source: "body" | "query" | "params";
  issues?: readonly core.$ZodIssue[];
};

function stackFrames(error: unknown): string | undefined {
  return error instanceof Error
    ? error.stack?.split("\n").filter((line) => /^\s+at /.test(line)).slice(0, 20).join("\n")
    : undefined;
}

function causeDiagnostics(cause: unknown): string | undefined {
  const diagnostics: Record<string, string | number>[] = [];
  const seen = new Set<unknown>();

  // Nur Diagnosefelder übernehmen, keine beliebigen Provider-Antworten oder Anfrageinhalte.
  while (cause != null && diagnostics.length < 5 && !seen.has(cause)) {
    seen.add(cause);
    if (typeof cause === "string") {
      diagnostics.push({ message: cause });
      break;
    }
    if (typeof cause !== "object") break;

    const item = cause as Record<string, unknown>;
    const frames = stackFrames(cause);

    diagnostics.push({
      type: cause instanceof Error ? cause.name : "Object",
      ...(typeof item.message === "string" ? { message: item.message } : {}),
      ...(typeof item.code === "string" || typeof item.code === "number" ? { code: item.code } : {}),
      ...(typeof item.status === "string" || typeof item.status === "number" ? { status: item.status } : {}),
      ...(frames ? { stack: frames } : {}),
    });
    cause = item.cause;
  }

  return diagnostics.length ? JSON.stringify(diagnostics) : undefined;
}

export function errorResponse(error: unknown, validation?: ValidationContext): Response {
  const original = error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") error = createApiError(ERROR_API.UNIQUE_CONSTRAINT_ERROR);
    else if (error.code === "P2034") error = createApiError(ERROR_API.TRANSACTION_CONFLICT);
    else if (error.code === "P2025") error = createApiError(ERROR_API.NOT_FOUND);
  }

  const apiError = error instanceof ApiError ? error : createApiError(ERROR_API.INTERNAL_SERVER_ERROR);
  const frames = stackFrames(original);
  const cause = causeDiagnostics(original instanceof Error ? original.cause : undefined);

  // Auch bewusst behandelte Fehler genau einmal protokollieren; Validierungswerte bleiben privat.
  log("error", "api_error", {
    code: apiError.code,
    message: apiError.message,
    status_code: apiError.status,
    error_type: original instanceof Error ? original.name : "UnbekannterFehler",
    ...(!(error instanceof ApiError) && original instanceof Error ? { error_message: original.message } : {}),
    ...(original instanceof Prisma.PrismaClientKnownRequestError ? { prisma_code: original.code } : {}),
    ...(frames ? { error_stack: frames } : {}),
    ...(cause ? { error_cause: cause } : {}),
    ...(validation ? { validation_source: validation.source } : {}),
    ...(validation?.issues ? {
      validation_issues: JSON.stringify(validation.issues.map((issue) => ({
        path: issue.path,
        code: issue.code,
        ...(issue.code === "invalid_type" ? { expected: issue.expected } : {}),
        ...(issue.code === "invalid_format" ? { format: issue.format } : {}),
      }))),
    } : {}),
  });

  const hideServerError = process.env.NODE_ENV !== "development" && apiError.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const publicError = hideServerError ? ERROR_API.INTERNAL_SERVER_ERROR : apiError;
  const message = !(error instanceof ApiError) && process.env.NODE_ENV === "development" && original instanceof Error
    ? original.message
    : publicError.message;

  return Response.json({
    error: message,
    code: publicError.code,
    ...(apiError.status < HTTP_STATUS.INTERNAL_SERVER_ERROR && apiError.details !== undefined
      ? { details: apiError.details }
      : {}),
  }, {
    status: apiError.status,
    ...(apiError.status === HTTP_STATUS.TOO_MANY_REQUESTS ? { headers: { "Retry-After": "3600" } } : {}),
  });
}
