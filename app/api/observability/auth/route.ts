import { requireRole } from "@/lib/auth/api-guard";
import {
  ADMIN,
  SUPER_ADMIN,
} from "@/lib/auth/roles";
import {
  apiHandler,
  successResponse,
} from "@/lib/http";
import { HTTP_STATUS } from "@/lib/http/status";
import { GRAFANA_ROLES } from "@/lib/observability/roles";


export const GET = apiHandler(async () => {
  const apiGate = await requireRole(ADMIN);

  if (!apiGate.ok) return apiGate.response;

  const { user } = apiGate;
  const response = successResponse(undefined, HTTP_STATUS.NO_CONTENT);

  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Webauth-User", `projekt-${user.id}`);
  response.headers.set("X-Webauth-Role", user.role === SUPER_ADMIN ? GRAFANA_ROLES.ADMIN : GRAFANA_ROLES.EDITOR);

  return response;
});
