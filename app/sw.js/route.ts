import { ROUTES } from "@/lib/constants/routes";
import { serviceWorker } from "@/lib/pwa/service-worker";
import { HTTP_STATUS } from "@/lib/http/status";


export function GET() {
  return new Response(serviceWorker, {
    status: HTTP_STATUS.OK,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": ROUTES.home,
      "Content-Security-Policy": "default-src 'self'; script-src 'self'",
    },
  });
}
