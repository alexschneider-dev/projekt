import {
  beforeEach,
  expect,
  it,
  vi
} from "vitest";
import {
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Registration } from "@/components/auth/registration";
import { VerifyEmail } from "@/components/auth/verify-email";
import { ROUTES } from "@/lib/constants/routes";
import { ApiError } from "@/lib/http/api-error";
import { ERROR_REGISTRATION } from "@/lib/http/errors/registration";
import { ERROR_PASSWORD } from "@/lib/http/errors/password.mjs";


const mocks = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock("@/lib/http/fetch-json", () => ({ fetchJson: mocks.fetchJson }));
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/");
});

async function registrationForm() {
  const user = userEvent.setup();
  render(<Registration />);
  await user.type(screen.getByLabelText("E-Mail"), "USER@example.test");
  await user.type(screen.getByLabelText("Passwort (12 bis 128 Zeichen)"), "Test-Passwort-2026");
  return user;
}

it("prüft Registrierung, zeigt Versandstatus und leert das Passwort", async () => {
  const user = await registrationForm();
  mocks.fetchJson.mockResolvedValue({ accepted: true });
  await user.click(screen.getByRole("button", { name: "Registrieren" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Bestätigungslink");
  expect(mocks.fetchJson).toHaveBeenCalledWith(ROUTES.registerApi, {
    method: "POST",
    body: {
      email: "user@example.test",
      password: "Test-Passwort-2026"
    },
  });
  expect(screen.getByLabelText("Passwort (12 bis 128 Zeichen)")).toHaveValue("");
});

it("weist kurze Passwörter zurück und ermöglicht erneuten Versand ohne Passwort", async () => {
  const user = await registrationForm();
  await user.clear(screen.getByLabelText("Passwort (12 bis 128 Zeichen)"));
  await user.type(screen.getByLabelText("Passwort (12 bis 128 Zeichen)"), "kurz");
  await user.click(screen.getByRole("button", { name: "Registrieren" }));
  expect(await screen.findByText(ERROR_PASSWORD.INVALID_PASSWORD_LENGTH.message)).toBeVisible();
  expect(mocks.fetchJson).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Keine Bestätigungs-E-Mail erhalten?" }));
  await user.type(screen.getByLabelText("E-Mail"), "user@example.test");
  mocks.fetchJson.mockResolvedValue({ accepted: true });
  await user.click(screen.getByRole("button", { name: "Bestätigungslink erneut senden" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Bestätigungslink");
  expect(mocks.fetchJson).toHaveBeenCalledWith(ROUTES.resendVerificationApi, {
    method: "POST",
    body: {
      email: "user@example.test",
      password: ""
    },
  });
});

it.each([
  true,
  false
])("zeigt API- und unerwartete Registrierungsfehler (%s)", async (apiError) => {
  const user = await registrationForm();
  mocks.fetchJson.mockRejectedValue(apiError
    ? new ApiError(429, ERROR_REGISTRATION.RATE_LIMIT.code, ERROR_REGISTRATION.RATE_LIMIT.message)
    : new Error("Interner Fehler"));
  await user.click(screen.getByRole("button", { name: "Registrieren" }));
  expect(await screen.findByText(apiError ? ERROR_REGISTRATION.RATE_LIMIT.message : ERROR_REGISTRATION.FAILED.message)).toBeVisible();
});

it("verbraucht den Link erst nach Buttonklick und entfernt den Token aus der Adresszeile", async () => {
  const token = "a".repeat(64);
  window.history.replaceState(null, "", `${ROUTES.verifyEmail}#${token}`);
  const user = userEvent.setup();
  render(<VerifyEmail />);
  expect(window.location.hash).toBe("");
  expect(mocks.fetchJson).not.toHaveBeenCalled();
  mocks.fetchJson.mockResolvedValue({ verified: true });
  await user.click(screen.getByRole("button", { name: "E-Mail bestätigen" }));
  await waitFor(() => expect(mocks.fetchJson).toHaveBeenCalledWith(ROUTES.verifyEmailApi, {
    method: "POST",
    body: { token },
  }));
  expect(await screen.findByRole("status")).toHaveTextContent("Du kannst dich jetzt anmelden");
});
