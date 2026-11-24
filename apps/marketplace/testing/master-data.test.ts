import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { apiHandler } from "@/lib/http";
import {
  type InternalRole,
  hasRole,
  CUSTOMER,
  SELLER,
  SUPER_ADMIN
} from "@/lib/auth/roles";
import {
  create,
  list,
  read,
  update,
  deactivate
} from "@/lib/catalog/master-data-api";
import { optionBodySchema } from "@/lib/schemas/master-data";


const mocks = vi.hoisted(() => ({
  role: null as string | null,
  listOptions: vi.fn(),
  getOption: vi.fn(),
  createOption: vi.fn(),
  updateOption: vi.fn(),
}));
vi.mock("@/lib/catalog/master-data", () => ({
  listOptions: mocks.listOptions,
  getOption: mocks.getOption,
  createOption: mocks.createOption,
  updateOption: mocks.updateOption,
}));
vi.mock("@/lib/auth/api-guard", () => ({
  requireRole: vi.fn(async (role: InternalRole) => mocks.role && hasRole(mocks.role, role)
    ? {
      ok: true,
      user: { id: "admin" }
    }
    : {
      ok: false,
      response: new Response(null, { status: mocks.role ? 403 : 401 })
    }),
}));

const context = {
  params: Promise.resolve({
    dictionary: "materials",
    id: "material-1"
  })
};
function request(method: string, body: unknown = {
  label: "Eiche",
  active: true
}, origin = "https://marketplace.test") {
  return new Request("https://marketplace.test/marketplace/api/materials/material-1", {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_URL", "https://marketplace.test/marketplace/api/auth");
  mocks.role = null;
  mocks.listOptions.mockResolvedValue([]);
  mocks.createOption.mockResolvedValue({
    id: "material-1",
    label: "Eiche",
    active: true
  });
  mocks.getOption.mockResolvedValue({
    id: "material-1",
    label: "Eiche",
    active: true
  });
  mocks.updateOption.mockResolvedValue({
    id: "material-1",
    label: "Eiche",
    active: false
  });
});

describe("Stammdaten-API", () => {
  it.each([
    null,
    CUSTOMER,
    SELLER
  ])("verweigert sämtliche Schreiboperationen für %s", async (role) => {
    mocks.role = role;
    for (const [
      handler,
      method
    ] of [
      [
        create,
        "POST"
      ],
      [
        update,
        "PATCH"
      ],
      [
        deactivate,
        "DELETE"
      ]
    ] as const) {
      const result = await apiHandler(handler)(request(method), context);
      expect(result.status).toBe(role ? 403 : 401);
    }
    expect(mocks.createOption).not.toHaveBeenCalled();
    expect(mocks.updateOption).not.toHaveBeenCalled();
  });

  it("stellt aktive Einträge allen Verkäufern und öffentlichen Filtern bereit", async () => {
    mocks.role = SELLER;
    const result = await apiHandler(list)(new Request("https://marketplace.test/api/materials?categoryId=chairs"), context);
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.listOptions).toHaveBeenCalledWith("materials", "chairs", false);
    expect((await apiHandler(read)(new Request("https://marketplace.test/api/materials/material-1"), context)).status).toBe(200);
  });

  it("schützt deaktivierte Einträge und deren Listen vor Verkäufern", async () => {
    mocks.role = SELLER;
    const result = await apiHandler(list)(new Request("https://marketplace.test/api/materials?includeInactive=true"), context);
    expect(result.status).toBe(403);
    expect(mocks.listOptions).not.toHaveBeenCalled();
    mocks.getOption.mockResolvedValue({ active: false });
    expect((await apiHandler(read)(new Request("https://marketplace.test/api/materials/material-1"), context)).status).toBe(403);
  });

  it("erlaubt dem Super-Admin Anlegen, Umbenennen und Deaktivieren", async () => {
    mocks.role = SUPER_ADMIN;
    expect((await apiHandler(create)(request("POST"), context)).status).toBe(201);
    expect(mocks.createOption).toHaveBeenCalledWith("materials", "chairs", {
      label: "Eiche",
      active: true
    });
    expect((await apiHandler(update)(request("PATCH"), context)).status).toBe(200);
    expect((await apiHandler(deactivate)(request("DELETE"), context)).status).toBe(200);
    expect(mocks.updateOption).toHaveBeenLastCalledWith("materials", "material-1", { active: false });
  });

  it("weist fremde Ursprünge auch bei vorhandener Admin-Session ab", async () => {
    mocks.role = SUPER_ADMIN;
    const result = await apiHandler(create)(request("POST", {
      label: "Eiche",
      active: true
    }, "https://fremd.test"), context);
    expect(result.status).toBe(403);
    expect(mocks.createOption).not.toHaveBeenCalled();
  });

  it("validiert Body und Wörterbuch vor dem Schreiben", async () => {
    mocks.role = SUPER_ADMIN;
    expect((await apiHandler(create)(request("POST", {
      label: "",
      active: true
    }), context)).status).toBe(400);
    const invalid = { params: Promise.resolve({ dictionary: "users" }) };
    expect((await apiHandler(create)(request("POST"), invalid)).status).toBe(400);
    expect(mocks.createOption).not.toHaveBeenCalled();
    expect(optionBodySchema.safeParse({
      label: "Eiche",
      active: true,
      role: SUPER_ADMIN
    }).success).toBe(false);
  });
});
