import { createServer } from "node:http";
import { hostname } from "node:os";
import { registerOTel } from "@vercel/otel";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import type {
  ReadableSpan,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  Registry,
  Histogram,
  collectDefaultMetrics,
} from "prom-client";
import { ERROR_OBSERVABILITY } from "@/lib/http/errors/observability";
import { HTTP_STATUS } from "@/lib/http/status";
import { log } from "./logger";


const state = globalThis as typeof globalThis & {
  telemetryInitialized?: boolean;
};

export function initializeTelemetry() {
  if (state.telemetryInitialized) return;

  state.telemetryInitialized = true;

  const registry = new Registry();

  registry.setDefaultLabels({ service: "nextjs" });
  collectDefaultMetrics({ register: registry });

  const requests = new Histogram({
    name: "app_http_request_duration_seconds",
    help: "Dauer abgeschlossener Next.js-Anfragen vor dem Trace-Export",
    labelNames: [
      "route",
      "method",
      "status_code",
    ] as const,
    buckets: [
      0.005,
      0.01,
      0.025,
      0.05,
      0.1,
      0.25,
      0.5,
      1,
      2,
      5,
      10,
      30,
      60,
    ],
    registers: [registry],
  });

  const processor: SpanProcessor = {
    onStart() { },
    onEnd(span: ReadableSpan) {
      if (span.attributes["next.span_type"] !== "BaseServer.handleRequest") return;

      const status = Number(
        span.attributes["http.response.status_code"] ?? span.attributes["http.status_code"] ?? HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
      // Nur Route-Templates verwenden, niemals konkrete URLs oder Anfrageinhalte.
      const route = status === HTTP_STATUS.NOT_FOUND ? "<nicht-gefunden>" : String(
        span.attributes["http.route"] ?? "<unbekannt>"
      );
      const rawMethod = String(span.attributes["http.request.method"] ?? span.attributes["http.method"] ?? "OTHER");
      const method = [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "HEAD",
        "OPTIONS",
      ].includes(rawMethod) ? rawMethod : "OTHER";
      const seconds = span.duration[0] + span.duration[1] / 1e9;

      requests.observe({
        route,
        method,
        status_code: String(status),
      }, seconds);

      log(status >= HTTP_STATUS.INTERNAL_SERVER_ERROR ? "error" : "info", "http_request", {
        route,
        method,
        status_code: status,
        duration_seconds: seconds,
        trace_id: span.spanContext().traceId,
        span_id: span.spanContext().spanId,
      });
    },
    async forceFlush() { },
    async shutdown() { },
  };

  registerOTel({
    serviceName: "nextjs",
    attributes: {
      "service.instance.id": hostname(),
      "service.version": process.env.OTEL_SERVICE_VERSION || "unbekannt",
      "deployment.environment.name": process.env.NODE_ENV || "development",
    },
    // Die Request-Histogramme müssen jede Anfrage vor dem Export sehen.
    traceSampler: "always_on",
    spanProcessors: [
      processor,
      "auto",
    ],
    instrumentations: [
      "auto",
      new PrismaInstrumentation(),
    ],
  });

  const server = createServer(async (req, res) => {
    if (req.url !== "/metrics") {
      res.writeHead(HTTP_STATUS.NOT_FOUND).end();

      return;
    }

    try {
      res.setHeader("Content-Type", registry.contentType);
      res.end(await registry.metrics());
    } catch {
      res.writeHead(HTTP_STATUS.INTERNAL_SERVER_ERROR).end();
    }
  });

  server.on("error", () => log("error", ERROR_OBSERVABILITY.METRICS_LISTENER.code));
  server.listen(9464, "0.0.0.0");
  server.unref();
}
