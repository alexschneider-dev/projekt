import { createHash } from "node:crypto";
import {
  apiHandler,
  successResponse,
} from "@/lib/http";


export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  // Die öffentliche Release-Kennung enthält keine interne Image-Adresse.
  const version = process.env.OTEL_SERVICE_VERSION;
  const release = version
    ? createHash("sha256").update(version).digest("hex").slice(0, 16)
    : "unbekannt";

  const response = successResponse({
    enabled: process.env.OBSERVABILITY_ENABLED === "true",
    release,
    environment: process.env.NODE_ENV || "development",
  });

  response.headers.set("Cache-Control", "no-store");

  return response;
});
