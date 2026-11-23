import { withBasePath } from "@/lib/constants/base-path";
import { ROUTES } from "@/lib/constants/routes";
import { serviceWorker } from "@/lib/pwa/service-worker";
import { HTTP_STATUS } from "@/lib/http/status";


export function GET() {
  return new Response(serviceWorker, {
    status: HTTP_STATUS.OK,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": withBasePath(ROUTES.home),
      "Content-Security-Policy": "default-src 'self'; script-src 'self'",
    },
  });
}
