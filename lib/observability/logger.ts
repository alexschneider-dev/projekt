import { trace } from "@opentelemetry/api";


export function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, string | number | boolean> = {}
) {
  const span = trace.getActiveSpan()?.spanContext();

  console[level](JSON.stringify({
    ...fields,
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "nextjs",
    version: process.env.OTEL_SERVICE_VERSION || "unbekannt",
    ...(span ? {
      trace_id: span.traceId,
      span_id: span.spanId,
    } : {}),
  }));
}
