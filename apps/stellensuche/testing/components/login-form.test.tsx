import {
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/auth/login-form";
import { ROUTES } from "@/lib/constants/routes";
import { ERROR_AUTH } from "@/lib/http/errors/auth";
import { ERROR_VALIDATION } from "@/lib/http/errors/validation.mjs";


const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ signIn: mocks.signIn }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

async function fillForm() {
  const user = userEvent.setup();

  render(<LoginForm />);
  await user.type(screen.getByLabelText("E-Mail"), "USER@Example.test");
  await user.type(screen.getByLabelText("Passwort"), " Passwort mit Leerzeichen ");

  return user;
}

it("verknüpft Feldfehler barrierefrei und sendet ungültige Eingaben nicht", async () => {
  const user = userEvent.setup();

  render(<LoginForm />);
  await user.click(screen.getByRole("button", { name: "Anmelden" }));

  expect(await screen.findByText(ERROR_VALIDATION.EMAIL_REQUIRED.message)).toBeVisible();
  expect(screen.getByLabelText("E-Mail")).toHaveAccessibleDescription(ERROR_VALIDATION.EMAIL_REQUIRED.message);
  expect(screen.getByLabelText("Passwort")).toHaveAccessibleDescription(ERROR_VALIDATION.PASSWORD_REQUIRED.message);
  expect(screen.getByLabelText("E-Mail")).toHaveFocus();
  expect(mocks.signIn).not.toHaveBeenCalled();
});

it("sperrt das Formular beim Absenden und navigiert danach zur Homepage", async () => {
  let finish!: (value: { ok: boolean }) => void;

  mocks.signIn.mockImplementation(() => new Promise(resolve => { finish = resolve; }));

  const user = await fillForm();

  await user.click(screen.getByRole("button", { name: "Anmelden" }));

  expect(screen.getByRole("button", { name: "Anmeldung läuft …" })).toBeDisabled();
  expect(screen.getByLabelText("E-Mail")).toBeDisabled();
  expect(screen.getByLabelText("Passwort")).toBeDisabled();
  expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
    email: "user@example.test",
    password: " Passwort mit Leerzeichen ",
    redirect: false,
    callbackUrl: ROUTES.home,
  });

  finish({ ok: true });
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(ROUTES.home));

  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it.each([
  undefined,
  { ok: false },
  {
    ok: true,
    error: "CredentialsSignin",
  },
])("zeigt abgewiesene Zugangsdaten ohne Navigation", async (result) => {
  mocks.signIn.mockResolvedValue(result);

  const user = await fillForm();

  await user.click(screen.getByRole("button", { name: "Anmelden" }));

  expect(await screen.findByText(ERROR_AUTH.LOGIN_FAILED.message)).toBeVisible();
  expect(screen.getByRole("button", { name: "Anmelden" })).toBeEnabled();
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("ermöglicht nach einem Netzwerkfehler einen erneuten Versuch", async () => {
  mocks.signIn.mockRejectedValueOnce(new Error(ERROR_AUTH.LOGIN_UNAVAILABLE.message));
  mocks.signIn.mockResolvedValueOnce({ ok: true });

  const user = await fillForm();

  await user.click(screen.getByRole("button", { name: "Anmelden" }));

  expect(await screen.findByText(ERROR_AUTH.LOGIN_UNAVAILABLE.message)).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Anmelden" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(ROUTES.home));
});
