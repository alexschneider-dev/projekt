import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import {
  GET,
  POST
} from "@/app/api/cart/route";
import { POST as SYNC } from "@/app/api/cart/sync/route";
import { DELETE } from "@/app/api/cart/[productId]/route";
import { CUSTOMER } from "@/lib/auth/roles";


const mocks = vi.hoisted(() => ({
  allowed: true,
  requireRole: vi.fn(),
  getCart: vi.fn(),
  addToCart: vi.fn(),
  syncCart: vi.fn(),
  removeFromCart: vi.fn()
}));
vi.mock("@/lib/auth/api-guard", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/cart/service", () => ({
  getCart: mocks.getCart,
  addToCart: mocks.addToCart,
  syncCart: mocks.syncCart,
  removeFromCart: mocks.removeFromCart
}));

function request(method = "GET", body?: unknown, origin = "https://marketplace.test") {
  return new Request("https://marketplace.test/marketplace/api/cart", {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json"
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_URL", "https://marketplace.test/marketplace/api/auth");
  mocks.requireRole.mockResolvedValue({
    ok: true,
    user: {
      id: "eigener-benutzer",
      role: CUSTOMER
    }
  });
  const cart = {
    items: [],
    limit: 10,
    totalCents: 0
  };
  mocks.getCart.mockResolvedValue(cart);
  mocks.addToCart.mockResolvedValue(cart);
  mocks.removeFromCart.mockResolvedValue(cart);
});

describe("Warenkorb-API", () => {
  it("liefert ausschließlich den Warenkorb der geprüften Session ohne Cache", async () => {
    const result = await GET(request(), undefined);
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.getCart).toHaveBeenCalledWith("eigener-benutzer");
    expect(mocks.requireRole).toHaveBeenCalledWith(CUSTOMER);
  });

  it("verweigert Gästen Lesen, Hinzufügen und Entfernen", async () => {
    mocks.requireRole.mockImplementation(async () => ({
      ok: false,
      response: new Response(null, { status: 401 })
    }));
    expect((await GET(request(), undefined)).status).toBe(401);
    expect((await POST(request("POST", { offerId: "offer-1" }), undefined)).status).toBe(401);
    expect((await DELETE(request("DELETE"), { params: Promise.resolve({ productId: "1" }) })).status).toBe(401);
    expect(mocks.getCart).not.toHaveBeenCalled();
    expect(mocks.addToCart).not.toHaveBeenCalled();
    expect(mocks.removeFromCart).not.toHaveBeenCalled();
  });

  it("vertraut weder Benutzer-ID noch Preis aus dem Request", async () => {
    const result = await POST(request("POST", {
      offerId: "offer-1",
      userId: "fremd",
      priceCents: 1
    }), undefined);
    expect(result.status).toBe(400);
    expect(mocks.addToCart).not.toHaveBeenCalled();
    expect((await POST(request("POST", { offerId: "offer-1" }), undefined)).status).toBe(200);
    expect(mocks.addToCart).toHaveBeenCalledWith("eigener-benutzer", "offer-1");
  });

  it("begrenzt Entfernen auf den eigenen Warenkorb", async () => {
    expect((await DELETE(request("DELETE"), { params: Promise.resolve({ productId: "17" }) })).status).toBe(200);
    expect(mocks.removeFromCart).toHaveBeenCalledWith("eigener-benutzer", 17);
    expect((await DELETE(request("DELETE"), { params: Promise.resolve({ productId: "-1" }) })).status).toBe(400);
    expect(mocks.removeFromCart).toHaveBeenCalledTimes(1);
  });

  it("blockiert Änderungen von fremden Websites", async () => {
    expect((await POST(request("POST", { offerId: "offer-1" }, "https://fremd.test"), undefined)).status).toBe(403);
    expect((await DELETE(request("DELETE", undefined, "https://fremd.test"), { params: Promise.resolve({ productId: "17" }) })).status).toBe(403);
    expect(mocks.addToCart).not.toHaveBeenCalled();
    expect(mocks.removeFromCart).not.toHaveBeenCalled();
  });
});

it("synchronisiert nur Angebots-IDs für die geprüfte Session", async () => {
  mocks.syncCart.mockResolvedValue({
    cart: { items: [] },
    skipped: []
  });
  expect((await SYNC(request("POST", { offerIds: ["offer-1"] }), undefined)).status).toBe(200);
  expect(mocks.syncCart).toHaveBeenCalledWith("eigener-benutzer", ["offer-1"]);
  expect((await SYNC(request("POST", { offerIds: Array(11).fill("offer-1") }), undefined)).status).toBe(400);
  expect((await SYNC(request("POST", {
    offerIds: [],
    userId: "fremd"
  }), undefined)).status).toBe(400);
  expect((await SYNC(request("POST", { offerIds: [] }, "https://fremd.test"), undefined)).status).toBe(403);
  expect(mocks.syncCart).toHaveBeenCalledTimes(1);
});
