import type { Instrumentation } from "next";
import { ERROR_OBSERVABILITY } from "@/lib/http/errors/observability";


export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.OBSERVABILITY_ENABLED === "true") {
    const { initializeTelemetry } = await import("./lib/observability/server");
    initializeTelemetry();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  if (process.env.OBSERVABILITY_ENABLED !== "true") return;

  const { log } = await import("./lib/observability/logger");

  log("error", ERROR_OBSERVABILITY.REQUEST_FAILED.code, {
    route: context.routePath,
    error_type: error instanceof Error ? error.name : "UnbekannterFehler",
  });
};
