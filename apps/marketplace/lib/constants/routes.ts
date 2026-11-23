export const ROUTES = {
  home: "/",
  grafana: "/grafana/",
  observabilityAuth: "/api/observability/auth",
  login: "/login",
  register: "/registrieren",
  verifyEmail: "/email-bestaetigen",
  registerApi: "/api/registration",
  resendVerificationApi: "/api/registration/resend",
  verifyEmailApi: "/api/registration/verify",
  dashboard: "/konto",
  seller: "/verkaufen",
  superAdmin: "/verwaltung",
  products: "/produkte",
  productsApi: "/api/products",
  offersApi: "/api/seller/offers",
  credits: "/bildnachweise",
} as const;

export const productHref = (slug: string) => `${ROUTES.products}/${encodeURIComponent(slug)}`;
