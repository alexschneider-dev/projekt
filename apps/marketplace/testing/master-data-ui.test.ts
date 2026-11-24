// @vitest-environment jsdom
import { createElement } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query";
import { MasterDataList } from "@/components/account/master-data/list";
import {
  MasterDataCreate,
  MasterDataEdit
} from "@/components/account/master-data/editor";
import { MasterData } from "@/components/account/master-data";
import { ApiError } from "@/lib/http/api-error";
import { ERROR_MASTER_DATA } from "@/lib/http/errors/master-data";
import { HTTP_STATUS } from "@/lib/http/status";


const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  push: vi.fn(),
  replace: vi.fn()
}));
vi.mock("@/lib/http/fetch-json", () => ({ fetchJson: mocks.fetchJson }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace
  })
}));
vi.mock("next/link", () => ({ default: (props: Record<string, unknown>) => createElement("a", props) }));

const material = {
  id: "material-17",
  attributeId: "chairs-material",
  label: "Eiche",
  active: true
};
function mount(element: ReturnType<typeof createElement>) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return render(createElement(QueryClientProvider, { client }, element));
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("Stammdatenseiten", () => {
  it("verlinkt die vier getrennten Bereiche ohne eingebettete Formulare", () => {
    mount(createElement(MasterData));
    expect(screen.getByRole("link", { name: "Materialien" }).getAttribute("href")).toBe("/verwaltung/materialien");
    expect(screen.getByRole("link", { name: "Farben" }).getAttribute("href")).toBe("/verwaltung/farben");
    expect(screen.getByRole("link", { name: "Stuhltypen" }).getAttribute("href")).toBe("/verwaltung/stuhltypen");
    expect(screen.getByRole("link", { name: "Modellnamen" }).getAttribute("href")).toBe("/verwaltung/modellnamen");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("öffnet vom Plus-Link die Anlegeseite und von der Zeile die ID-Seite", async () => {
    mocks.fetchJson.mockResolvedValue([material]);
    mount(createElement(MasterDataList, { dictionary: "materials" }));
    expect(screen.getByRole("link", { name: "Material anlegen" }).getAttribute("href")).toBe("/verwaltung/materialien/neu");
    const link = await screen.findByRole("link", { name: "Eiche" });
    expect(link.getAttribute("href")).toBe("/verwaltung/materialien/material-17");
    expect(screen.getByRole("table", { name: "Materialien" })).toBeDefined();

    await userEvent.click(screen.getByRole("cell", { name: "Aktiv" }));
    expect(mocks.push).toHaveBeenCalledWith("/verwaltung/materialien/material-17");
  });

  it("legt auf einer eigenen Seite an und wechselt zur zurückgegebenen ID", async () => {
    mocks.fetchJson.mockResolvedValue(material);
    mount(createElement(MasterDataCreate, { dictionary: "materials" }));
    await userEvent.type(screen.getByLabelText("Bezeichnung"), "Eiche");
    await userEvent.click(screen.getByRole("button", { name: "Anlegen" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/verwaltung/materialien/material-17"));
    expect(mocks.fetchJson).toHaveBeenCalledWith("/api/materials?categoryId=chairs", {
      method: "POST",
      body: {
        label: "Eiche",
        active: true
      },
    });
  });

  it("lädt anhand der ID und speichert Umbenennung und Deaktivierung", async () => {
    mocks.fetchJson.mockResolvedValueOnce(material).mockResolvedValue({
      ...material,
      label: "Buche",
      active: false
    });
    mount(createElement(MasterDataEdit, {
      dictionary: "materials",
      id: material.id
    }));
    const field = await screen.findByLabelText("Bezeichnung");
    expect((field as HTMLInputElement).value).toBe("Eiche");
    await userEvent.clear(field);
    await userEvent.type(field, "Buche");
    await userEvent.selectOptions(screen.getByLabelText("Verfügbarkeit"), "false");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await screen.findByText("Gespeichert.");
    expect(mocks.fetchJson).toHaveBeenLastCalledWith("/api/materials/material-17", {
      method: "PATCH",
      body: {
        label: "Buche",
        active: false
      },
    });
  });

  it("zeigt Ladefehler ohne ein leeres Bearbeitungsformular vorzutäuschen", async () => {
    mocks.fetchJson.mockRejectedValue(new ApiError(HTTP_STATUS.NOT_FOUND, ERROR_MASTER_DATA.NOT_FOUND.code, ERROR_MASTER_DATA.NOT_FOUND.message));
    mount(createElement(MasterDataEdit, {
      dictionary: "materials",
      id: "unbekannt"
    }));
    await screen.findByText(ERROR_MASTER_DATA.NOT_FOUND.message);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Erneut laden" })).toBeDefined();
  });
});
