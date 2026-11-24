import {
  beforeEach,
  expect,
  it,
  vi
} from "vitest";
import { POST } from "@/app/api/admin/demo-products/route";
import { SUPER_ADMIN } from "@/lib/auth/roles";


const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  create: vi.fn()
}));
vi.mock("@/lib/auth/api-guard", () => ({ requireRole: mocks.gate }));
vi.mock("@/lib/catalog/demo-products", () => ({ createDemoProducts: mocks.create }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_URL", "https://marketplace.test/marketplace/api/auth");
  mocks.gate.mockResolvedValue({
    ok: true,
    user: {
      id: "admin",
      role: SUPER_ADMIN
    }
  });
  mocks.create.mockResolvedValue({
    created: 1000
  });
});

function request(origin = "https://marketplace.test") {
  return new Request("https://marketplace.test/marketplace/api/admin/demo-products", {
    method: "POST",
    headers: { Origin: origin }
  });
}

it("verlangt Super-Admin und liefert die Anzahl ohne Cache", async () => {
  const response = await POST(request(), undefined);
  expect(mocks.gate).toHaveBeenCalledWith(SUPER_ADMIN);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({
    created: 1000
  });
});

it("erzeugt bei fehlenden Rechten keine Produkte", async () => {
  mocks.gate.mockResolvedValue({
    ok: false,
    response: new Response(null, { status: 403 })
  });
  expect((await POST(request(), undefined)).status).toBe(403);
  expect(mocks.create).not.toHaveBeenCalled();
});

it("blockiert fremde Origins", async () => {
  expect((await POST(request("https://fremd.test"), undefined)).status).toBe(403);
  expect(mocks.create).not.toHaveBeenCalled();
});
