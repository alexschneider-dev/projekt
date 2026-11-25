import {
  beforeEach,
  expect,
  it,
  vi
} from "vitest";
import { PATCH as offerPatch } from "@/app/api/seller/offers/[offerId]/availability/route";
import { PATCH as sellerPatch } from "@/app/api/admin/sellers/[sellerId]/status/route";
import {
  SELLER,
  SUPER_ADMIN
} from "@/lib/auth/roles";


const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  offer: vi.fn(),
  seller: vi.fn()
}));
vi.mock("@/lib/auth/api-guard", () => ({ requireRole: mocks.gate }));
vi.mock("@/lib/catalog/offer-availability", () => ({ updateOfferAvailability: mocks.offer }));
vi.mock("@/lib/catalog/seller-status", () => ({ updateSellerStatus: mocks.seller }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_URL", "https://marketplace.test/marketplace/api/auth");
  mocks.gate.mockResolvedValue({
    ok: true,
    user: { id: "eigener-benutzer" }
  });
  mocks.offer.mockResolvedValue({ success: true });
  mocks.seller.mockResolvedValue({ success: true });
});

function request(body: unknown, origin = "https://marketplace.test") {
  return new Request("https://marketplace.test/marketplace/api/seller/offers/angebot/availability", {
    method: "PATCH",
    headers: {
      Origin: origin,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

const offerContext = { params: Promise.resolve({ offerId: "angebot" }) };
const sellerContext = { params: Promise.resolve({ sellerId: "verkäufer" }) };

it("bindet die Angebotsänderung an die geprüfte Session und Verkäuferrolle", async () => {
  const input = {
    active: true,
    stock: 4
  };
  const response = await offerPatch(request(input), offerContext);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(mocks.gate).toHaveBeenCalledWith(SELLER);
  expect(mocks.offer).toHaveBeenCalledWith("eigener-benutzer", "angebot", input);
});

it("verlangt Super-Admin zum Aktivieren von Verkäuferkonten", async () => {
  expect((await sellerPatch(request({ active: false }), sellerContext)).status).toBe(200);
  expect(mocks.gate).toHaveBeenCalledWith(SUPER_ADMIN);
  expect(mocks.seller).toHaveBeenCalledWith("verkäufer", { active: false });
});

it("verhindert Schreibzugriffe bei verweigertem Zugriff", async () => {
  mocks.gate.mockResolvedValue({
    ok: false,
    response: new Response(null, { status: 403 })
  });
  expect((await offerPatch(request({}), offerContext)).status).toBe(403);
  expect((await sellerPatch(request({}), sellerContext)).status).toBe(403);
  expect(mocks.offer).not.toHaveBeenCalled();
  expect(mocks.seller).not.toHaveBeenCalled();
});

it("verwirft fremde Origins, negative Bestände und eingeschleuste Benutzer- oder Rollenwerte", async () => {
  for (const input of [
    { active: true },
    {
      active: true,
      stock: -1
    },
    {
      active: true,
      stock: 1,
      userId: "fremd"
    }
  ]) expect((await offerPatch(request(input), offerContext)).status).toBe(400);
  expect((await offerPatch(request({}, "https://fremd.test"), offerContext)).status).toBe(403);
  expect((await sellerPatch(request({
    active: true,
    role: SUPER_ADMIN
  }), sellerContext)).status).toBe(400);
  expect(mocks.offer).not.toHaveBeenCalled();
  expect(mocks.seller).not.toHaveBeenCalled();
});
