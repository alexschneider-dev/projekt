import {
  afterEach,
  expect,
  it,
  vi,
} from "vitest";
import {
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PwaSupport } from "@/components/pwa/pwa-support";


function mockDevice(userAgent: string, standalone = false, platform = "iPhone", maxTouchPoints = 1) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: standalone,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "maxTouchPoints");
});

it.each([
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1",
])("zeigt die Installationshilfe auf dem iPhone ohne Browser-Installationsereignis: %s", async (userAgent) => {
  mockDevice(userAgent);
  const user = userEvent.setup();
  render(<PwaSupport />);

  const button = screen.getByRole("button", { name: "App installieren" });
  expect(button).toHaveAttribute("aria-expanded", "false");
  await user.click(button);

  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("region", { name: "Installation auf iPhone und iPad" })).toBeVisible();
  expect(screen.getByText(/Scrolle im Teilen-Menü/)).toBeVisible();
  await user.click(button);

  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});

it("erkennt iPads auch mit Desktop-Browserkennung", () => {
  mockDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1.15", false, "MacIntel", 5);
  render(<PwaSupport />);

  expect(screen.getByRole("button", { name: "App installieren" })).toBeVisible();
});

it("blendet die Installationshilfe in der gestarteten App aus", () => {
  mockDevice("Mozilla/5.0 (iPhone)", true);
  render(<PwaSupport />);

  expect(screen.queryByRole("button", { name: "App installieren" })).not.toBeInTheDocument();
});
