import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import ts from "typescript";
import { readFileSync } from "node:fs";


// Die Hilfsfunktionen mit der TypeScript-Abhängigkeit des Projekts im Arbeitsspeicher kompilieren.
const require = createRequire(import.meta.url);
const previous = require.extensions[".ts"];
require.extensions[".ts"] = (
  module,
  filename
) => {
  const { outputText } = ts.transpileModule(
    readFileSync(
      filename,
      "utf8"
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      },
    }
  );
  module._compile(
    outputText,
    filename
  );
};
const { fetchJson } = require("../lib/http/fetch-json.ts");
const { ApiError } = require("../lib/http/api-error.ts");
const {
  createApiError,
  ERROR_API
} = require("../lib/http/errors/index.ts");
const {
  apiHandler,
  successResponse
} = require("../lib/http/index.ts");
const { checkApiRequest } = require("../lib/http/check-api-request.ts");
const { checkApiQuery } = require("../lib/http/check-api-query.ts");
const { checkApiParams } = require("../lib/http/check-api-params.ts");
if (previous) require.extensions[".ts"] = previous;
else delete require.extensions[".ts"];
const { z } = require("zod");
const { Prisma } = require("@prisma/client");

const request = (
  body,
  contentType = "application/json"
) => new Request(
  "https://example.test/api",
  {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  }
);

test(
  "request validation distinguishes format errors and returns field details",
  async () => {
    const schema = z.object({ name: z.string().min(1) });
    for (const [req, code, status] of [
      [
        request(
          '{}',
          "text/plain"
        ),
        "INVALID_CONTENT_TYPE",
        415
      ],
      [
        request('{'),
        "INVALID_JSON",
        400
      ],
      [
        request('{"name":""}'),
        "INVALID_BODY",
        400
      ],
    ]) {
      const result = await checkApiRequest(
        req,
        schema
      );
      assert.equal(
        result.ok,
        false
      );
      assert.equal(
        result.response.status,
        status
      );
      const payload = await result.response.json();
      assert.equal(
        payload.code,
        code
      );
      if (code === "INVALID_BODY") assert.ok(payload.details.fieldErrors.name);
    }
    assert.deepEqual(
      await checkApiRequest(
        request('{"name":"Ada"}'),
        schema
      ),
      {
        ok: true,
        data: { name: "Ada" },
      }
    );
    const form = new FormData();
    form.set(
      "name",
      "Ada"
    );
    assert.equal(
      (await checkApiRequest(
        new Request(
          "https://example.test",
          {
            method: "POST",
            body: form,
          }
        ),
        schema,
        true
      )).ok,
      true
    );
  }
);

test(
  "query and route params apply schemas and preserve transformed values",
  async () => {
    const schema = z.object({ id: z.coerce.number().int().positive() });
    assert.deepEqual(
      await checkApiQuery(
        new Request("https://example.test?id=42"),
        schema
      ),
      {
        ok: true,
        data: { id: 42 },
      }
    );
    assert.deepEqual(
      await checkApiParams(
        { id: "42" },
        schema
      ),
      {
        ok: true,
        data: { id: 42 }
      }
    );
    assert.equal(
      (await (await checkApiParams(
        { id: "bad" },
        schema
      )).response.json()).code,
      "INVALID_PARAMS"
    );
    assert.equal(
      (await (await checkApiQuery(
        new Request("https://example.test"),
        schema
      )).response.json()).code,
      "INVALID_QUERY"
    );
  }
);

test(
  "handler serializes intentional errors, maps Prisma conflicts and hides unexpected details",
  async (t) => {
    t.mock.method(
      console,
      "error",
      () => { }
    );
    for (const [error, code, status] of [
      [
        createApiError(
          ERROR_API.INVALID_BODY,
          { field: "name" }
        ),
        "INVALID_BODY",
        400
      ],
      [
        new Prisma.PrismaClientKnownRequestError(
          "private constraint",
          {
            code: "P2002",
            clientVersion: "6"
          }
        ),
        "UNIQUE_CONSTRAINT_ERROR",
        409
      ],
      [
        new Prisma.PrismaClientKnownRequestError(
          "private transaction",
          {
            code: "P2034",
            clientVersion: "6"
          }
        ),
        "TRANSACTION_CONFLICT",
        409
      ],
      [
        new Error("private database credentials"),
        "INTERNAL_SERVER_ERROR",
        500
      ],
    ]) {
      const response = await apiHandler(async () => { throw error; })(
        new Request("https://example.test"),
        {}
      );
      assert.equal(
        response.status,
        status
      );
      const payload = await response.json();
      assert.equal(
        payload.code,
        code
      );
      assert.doesNotMatch(
        JSON.stringify(payload),
        /private/
      );
      if (code === "INVALID_BODY") assert.deepEqual(
        payload.details,
        { field: "name" }
      );
    }
    assert.equal(
      await successResponse(false).json(),
      false
    );
    assert.equal(
      await successResponse(
        null,
        204
      ).text(),
      ""
    );
  }
);

test(
  "fetchJson supports methods, JSON, multipart and no-content responses",
  async (t) => {
    const calls = [];
    t.mock.method(
      globalThis,
      "fetch",
      async (...args) => {
        calls.push(args);
        return successResponse({ saved: true });
      }
    );
    for (const method of [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE"
    ]) {
      assert.deepEqual(
        await fetchJson(
          "/api/items",
          { method }
        ),
        { saved: true }
      );
      assert.equal(
        calls.at(-1)[1].method,
        method
      );
    }
    await fetchJson(
      "/api/items",
      {
        method: "POST",
        body: { name: "Ada" }
      }
    );
    assert.equal(
      calls.at(-1)[1].body,
      '{"name":"Ada"}'
    );
    assert.equal(
      calls.at(-1)[1].headers["Content-Type"],
      "application/json"
    );
    const body = new FormData();
    await fetchJson(
      "/api/items",
      {
        method: "POST",
        body
      }
    );
    assert.equal(
      calls.at(-1)[1].body,
      body
    );
    assert.equal(
      calls.at(-1)[1].headers,
      undefined
    );
    globalThis.fetch.mock.mockImplementation(async () => new Response(
      null,
      { status: 204 }
    ));
    assert.equal(
      await fetchJson(
        "/api/items",
        { method: "DELETE" }
      ),
      undefined
    );
  }
);

test(
  "fetchJson propagates server errors and distinguishes network, malformed response and abort",
  async (t) => {
    const fetchMock = t.mock.method(
      globalThis,
      "fetch",
      async () => Response.json(
        {
          code: "INVALID_BODY",
          error: "Bitte prüfen",
          details: { name: ["Required"] },
        },
        { status: 400 }
      )
    );
    await assert.rejects(
      fetchJson("/api"),
      (error) => error instanceof ApiError
        && error.status === 400 && error.details.name[0] === "Required"
    );
    fetchMock.mock.mockImplementation(async () => new Response(
      "Bad gateway",
      { status: 502 }
    ));
    await assert.rejects(
      fetchJson("/api"),
      {
        status: 502,
        code: "INTERNAL_SERVER_ERROR"
      }
    );
    fetchMock.mock.mockImplementation(async () => new Response("not json"));
    await assert.rejects(
      fetchJson("/api"),
      { code: "INVALID_RESPONSE" }
    );
    fetchMock.mock.mockImplementation(async () => { throw new TypeError("Failed to fetch"); });
    await assert.rejects(
      fetchJson("/api"),
      { code: "NETWORK_ERROR" }
    );
    const abort = new DOMException(
      "Aborted",
      "AbortError"
    );
    fetchMock.mock.mockImplementation(async () => { throw abort; });
    await assert.rejects(
      fetchJson("/api"),
      (error) => error === abort
    );
  }
);
