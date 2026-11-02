export const ROUTES = {
  observabilityAuth: "/api/observability/auth",
  authCsrf: "/api/auth/csrf",
  authCredentials: "/api/auth/callback/credentials",
  authSession: "/api/auth/session",
  grafana: "/grafana/",
  telemetryConfig: "/api/telemetry-config",
  telemetryCollect: "/collect",
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  admin: "/admin",
  superAdmin: "/super-admin",
} as const;
