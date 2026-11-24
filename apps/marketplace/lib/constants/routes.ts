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
  cart: "/warenkorb",
  demoProductsApi: "/api/admin/demo-products",
  cartSyncApi: "/api/cart/sync",
  cartApi: "/api/cart",
  dashboard: "/konto",
  seller: "/verkaufen",
  superAdmin: "/verwaltung",
  adminMaterials: "/verwaltung/materialien",
  adminColors: "/verwaltung/farben",
  adminChairTypes: "/verwaltung/stuhltypen",
  adminModelNames: "/verwaltung/modellnamen",
  products: "/produkte",
  materialsApi: "/api/materials",
  colorsApi: "/api/colors",
  chairTypesApi: "/api/chair-types",
  modelNamesApi: "/api/model-names",
  productsApi: "/api/products",
  offersApi: "/api/seller/offers",
  credits: "/bildnachweise",
} as const;

export const productHref = (slug: string) => `${ROUTES.products}/${encodeURIComponent(slug)}`;

export const masterDataCreateHref = (listHref: string) => `${listHref}/neu`;
export const masterDataEditHref = (listHref: string, id: string) => `${listHref}/${encodeURIComponent(id)}`;

export const cartItemApiHref = (productId: number) => `${ROUTES.cartApi}/${productId}`;
