import {
  apiHandler,
  successResponse,
} from "@/lib/http";


export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const response = successResponse({
    enabled: process.env.OBSERVABILITY_ENABLED === "true",
    release: process.env.OTEL_SERVICE_VERSION || "unbekannt",
    environment: process.env.NODE_ENV || "development",
  });

  response.headers.set("Cache-Control", "no-store");

  return response;
});
