import {
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import HomePage from "@/app/page";
import LoginPage from "@/app/(auth)/login/page";
import RegistrationPage from "@/app/(auth)/registrieren/page";
import { ROUTES } from "@/lib/constants/routes";


const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/auth/api-guard", () => ({ requireRole: mocks.requireRole }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/auth/login", () => ({ Login: () => null }));
vi.mock("@/components/auth/registration", () => ({ Registration: () => null }));

beforeEach(() => vi.resetAllMocks());

it.each([
  false,
  true,
])("Homepage erhält den serverseitig geprüften Anmeldestatus: %s", async (authenticated) => {
  mocks.requireRole.mockResolvedValue({ ok: authenticated });
  const page = await HomePage();
  expect(page.props.authenticated).toBe(authenticated);
});

it.each([
  LoginPage,
  RegistrationPage,
])("Gastseite bleibt ohne Anmeldung erreichbar", async (page) => {
  mocks.requireRole.mockResolvedValue({ ok: false });
  expect(await page()).toBeTruthy();
  expect(mocks.redirect).not.toHaveBeenCalled();
});

it.each([
  LoginPage,
  RegistrationPage,
])("Gastseite leitet angemeldete Benutzer zur Homepage weiter", async (page) => {
  const redirected = Symbol("Weiterleitung");
  mocks.requireRole.mockResolvedValue({ ok: true });
  mocks.redirect.mockImplementation(() => { throw redirected; });
  await expect(page()).rejects.toBe(redirected);
  expect(mocks.redirect).toHaveBeenCalledWith(ROUTES.home);
});
