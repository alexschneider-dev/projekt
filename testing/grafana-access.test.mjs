import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as roles from "../lib/auth/roles.ts";
import { HTTP_STATUS } from "../lib/http/status.ts";
import { GRAFANA_ROLES } from "../lib/observability/roles.ts";


const source = readFileSync(
  new URL(
    "../app/api/observability/auth/route.ts",
    import.meta.url
  ),
  "utf8"
);
const compiled = ts.transpileModule(
  source,
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }
).outputText;

test(
  "Grafana-Endpunkt erlaubt ausschließlich SUPER_ADMIN und gibt sonst keine Identitätsheader aus",
  async () => {
    for (const [
      role,
      expected,
    ] of [
      [
        undefined,
        401,
      ],
      [
        roles.USER,
        403,
      ],
      [
        roles.ADMIN,
        403,
      ],
      [
        roles.SUPER_ADMIN,
        204,
      ],
    ]) {
      const exported = {};
      const dependencies = {
        "@/lib/auth/roles": roles,
        "@/lib/http/status": { HTTP_STATUS },
        "@/lib/observability/roles": { GRAFANA_ROLES },
        "@/lib/auth/api-guard": {
          requireRole: async required => {
            assert.equal(
              required,
              roles.SUPER_ADMIN
            );
            if (!role || !roles.hasRole(
              role,
              required
            )) return {
              ok: false,
              response: new Response(
                null,
                { status: role ? 403 : 401 }
              ),
            };
            return {
              ok: true,
              user: {
                id: "test-user",
                role,
              },
            };
          },
        },
        "@/lib/http": {
          apiHandler: handler => handler,
          successResponse: (
            _data,
            status
          ) => new Response(
            null,
            { status }
          ),
        },
      };
      runInNewContext(
        compiled,
        {
          exports: exported,
          require: name => dependencies[name],
        }
      );
      const response = await exported.GET();
      assert.equal(
        response.status,
        expected
      );
      assert.equal(
        response.headers.get("X-Webauth-Role"),
        expected === 204 ? "Admin" : null
      );
      assert.equal(
        response.headers.get("X-Webauth-User"),
        expected === 204 ? "projekt-test-user" : null
      );
    }
  }
);
