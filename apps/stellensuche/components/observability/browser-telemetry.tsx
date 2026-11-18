"use client";

import { useEffect } from "react";
import { fetchJson } from "@/lib/http/fetch-json";
import { ROUTES } from "@/lib/constants/routes";
import { sanitizeTelemetry } from "@/lib/observability/sanitize";


let initialization: Promise<unknown> | undefined;

export function BrowserTelemetry() {
  useEffect(() => {
    if (initialization) return;

    initialization = fetchJson<{
      enabled: boolean;
      release: string;
      environment: string;
    }>(ROUTES.telemetryConfig, { method: "GET" }).then(async config => {
      if (!config.enabled) return;

      const [
        sdk,
        tracing
      ] = await Promise.all([
        import("@grafana/faro-web-sdk"),
        import("@grafana/faro-web-tracing"),
      ]);

      sdk.initializeFaro({
        url: ROUTES.telemetryCollect,
        app: {
          name: "browser",
          version: config.release,
          environment: config.environment,
        },
        // Keine Konsolenaufzeichnung, Benutzeridentität oder persistente Sitzung.
        instrumentations: [
          new sdk.ErrorsInstrumentation(),
          new sdk.WebVitalsInstrumentation(),
          new tracing.TracingInstrumentation(),
        ],
        sessionTracking: { enabled: false },
        beforeSend: item => sanitizeTelemetry(item) as typeof item,
      });
    }).catch(() => {
      initialization = undefined;
    });
  }, []);

  return null;
}
