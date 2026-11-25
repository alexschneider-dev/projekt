// @vitest-environment jsdom
import { createElement } from "react";
import {
  afterEach,
  expect,
  it,
  vi
} from "vitest";
import {
  act,
  cleanup,
  render,
  screen
} from "@testing-library/react";
import { ProductStatistics } from "@/components/product-statistics";


const mock = vi.hoisted(() => ({
  handlers: new Map<string, (value: unknown) => void>(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  io: vi.fn()
}));
vi.mock("socket.io-client", () => ({
  io: mock.io.mockImplementation(() => ({
    on: (name: string, handler: (value: unknown) => void) => mock.handlers.set(name, handler),
    off: (name: string) => mock.handlers.delete(name),
    connect: mock.connect,
    disconnect: mock.disconnect
  }))
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("zeigt Live-Zähler ohne Anmeldung, teilt den Socket und räumt Listener wieder auf", () => {
  const first = render(createElement(ProductStatistics));
  expect(screen.getByRole("status").textContent).toContain("Live · Echtzeit");
  expect(screen.getByRole("status").textContent).toContain("nicht verfügbar");
  expect(mock.io).toHaveBeenCalledWith("/statistics", expect.objectContaining({ transports: ["websocket"] }));

  act(() => mock.handlers.get("statistics")?.({
    version: 1,
    available: true,
    products: 1234,
    sellers: 1,
    revision: "1"
  }));
  expect(screen.getByRole("status").textContent).toContain("1.234 verfügbare Produkte · 1 aktiver Verkäufer");
  const second = render(createElement(ProductStatistics));
  expect(mock.io).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole("status").every(element => element.textContent?.includes("1.234"))).toBe(true);

  first.unmount();
  expect(mock.disconnect).not.toHaveBeenCalled();
  act(() => mock.handlers.get("disconnect")?.("transport close"));
  expect(screen.getByRole("status").textContent).toContain("nicht verfügbar");
  second.unmount();
  expect(mock.disconnect).toHaveBeenCalledTimes(1);
  expect(mock.handlers.size).toBe(0);
});
