import { requireRole } from "@/lib/auth/api-guard";
import { SUPER_ADMIN } from "@/lib/auth/roles";
import {
  apiHandler,
  successResponse,
} from "@/lib/http";
import { HTTP_STATUS } from "@/lib/http/status";
import { GRAFANA_ROLES } from "@/lib/observability/roles";


export const GET = apiHandler(async () => {
  const apiGate = await requireRole(SUPER_ADMIN);

  if (!apiGate.ok) return apiGate.response;

  const { user } = apiGate;
  const response = successResponse(
    undefined,
    HTTP_STATUS.NO_CONTENT
  );

  response.headers.set(
    "Cache-Control",
    "no-store"
  );
  response.headers.set(
    "X-Webauth-User",
    `projekt-${user.id}`
  );
  response.headers.set(
    "X-Webauth-Role",
    GRAFANA_ROLES.ADMIN
  );

  return response;
});
