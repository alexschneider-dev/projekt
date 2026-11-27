// @vitest-environment node
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { errorResponse } from "../../lib/http/error-response";
import { ApiError } from "../../lib/http/api-error";
import {
  createApiError,
  ERROR_API,
} from "../../lib/http/errors";
import { checkApiRequest } from "../../lib/http/check-api-request";
import { checkApiQuery } from "../../lib/http/check-api-query";
import { checkApiParams } from "../../lib/http/check-api-params";


afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Öffentliche Fehlermeldungen und interne Diagnose", () => {
  it("trennt öffentliche Details von begrenzten, zyklischen Ursachen", async () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = Object.assign(new Error("Interne Ursache"), {
      code: "PROVIDER_ERROR",
      body: "GEHEIMER_BODY",
      token: "GEHEIMER_TOKEN",
    });
    cause.cause = cause;

    const response = errorResponse(createApiError(ERROR_API.INVALID_BODY, {
      publicDetails: { field: "name" },
      cause,
    }));
    const payload = await response.json();
    const entry = JSON.parse(output.mock.calls[0]![0]);

    expect(payload.details).toEqual({ field: "name" });
    expect(JSON.stringify(payload)).not.toContain("Interne Ursache");
    expect(output).toHaveBeenCalledTimes(1);
    expect(JSON.parse(entry.error_cause)).toHaveLength(1);
    expect(entry.error_cause).toContain("PROVIDER_ERROR");
    expect(entry.error_cause).not.toContain("GEHEIMER_");
  });

  it("verbirgt auch beabsichtigte Serverfehler in Produktion und erhält den Status", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = errorResponse(new ApiError(503, "INTERNER_CODE", "Interne Diagnose", {
      publicDetails: { secret: "NICHT_OEFFENTLICH" },
      cause: new Error("Provider ausgefallen"),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: ERROR_API.INTERNAL_SERVER_ERROR.message,
      code: ERROR_API.INTERNAL_SERVER_ERROR.code,
    });
    expect(JSON.parse(output.mock.calls[0]![0]).error_cause).toContain("Provider ausgefallen");
  });

  it("protokolliert unerwartete Fehler und Prisma-Zuordnungen genau einmal", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = errorResponse(new Error("Interne Diagnose"));

    expect(JSON.stringify(await response.json())).not.toContain("Interne Diagnose");
    expect(JSON.parse(output.mock.calls[0]![0]).error_message).toBe("Interne Diagnose");

    const conflict = errorResponse(new Prisma.PrismaClientKnownRequestError("Interne SQL-Diagnose", {
      code: "P2002",
      clientVersion: "6",
    }));

    expect(conflict.status).toBe(409);
    expect(output).toHaveBeenCalledTimes(2);
    expect(JSON.parse(output.mock.calls[1]![0]).prisma_code).toBe("P2002");
  });

  it("protokolliert Validierungsmetadaten ohne Eingaben und freie Meldungen", async () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const schema = z.object({ name: z.string().min(20, "GEHEIME_MELDUNG") }).strict();
    const request = new Request("https://example.test/?name=GEHEIMER_WERT", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "GEHEIMER_WERT",
        GEHEIMER_SCHLUESSEL: "GEHEIMER_WERT",
      }),
    });
    const results = [
      await checkApiRequest(request, schema),
      await checkApiQuery(request, schema),
      await checkApiParams({ name: "GEHEIMER_WERT" }, schema),
    ];

    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(await result.response.json()).not.toHaveProperty("details");
    }
    expect(output).toHaveBeenCalledTimes(3);
    const entries = output.mock.calls.map((call) => JSON.parse(call[0]));

    expect(entries.map((entry) => entry.validation_source)).toEqual([
      "body",
      "query",
      "params",
    ]);
    expect(JSON.stringify(entries)).not.toContain("GEHEIM");
    expect(entries[0].validation_issues).toContain("too_small");
  });

  it("erhält Retry-After und zeigt unerwartete Meldungen nur in Entwicklung", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");

    expect((await errorResponse(new Error("Diagnose")).json()).error).toBe("Diagnose");
    expect(errorResponse(new ApiError(429, "LIMIT", "Limit erreicht")).headers.get("Retry-After")).toBe("3600");
  });
});
