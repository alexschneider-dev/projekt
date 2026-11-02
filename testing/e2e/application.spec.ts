import AxeBuilder from "@axe-core/playwright";
import {
  test,
  expect,
  login,
} from "../support/fixtures";
import {
  USER,
  ADMIN,
  SUPER_ADMIN,
} from "@/lib/auth/roles";
import { ROUTES } from "@/lib/constants/routes";
import { ERROR_AUTH } from "@/lib/http/errors/auth";
import { ERROR_VALIDATION } from "@/lib/http/errors/validation.mjs";
import { TEST_PASSWORD } from "../support/environment.mjs";


test("Homepage und Login sind öffentlich und per Tastatur bedienbar", async ({
  page,
  browserName
}) => {
  const tabKey = browserName === "webkit" && process.platform === "darwin" ? "Alt+Tab" : "Tab";

  await page.goto(ROUTES.home);

  await expect(page.getByRole("heading", {
    name: "Projekt",
    exact: true
  })).toBeVisible();
  // WebKit unter macOS erreicht Links mit der plattformüblichen Wahltaste.
  await page.keyboard.press(tabKey);
  await expect(page.getByRole("link", { name: "Anmelden" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(ROUTES.login);
  await page.getByLabel("E-Mail").focus();
  await page.keyboard.press(tabKey);
  await expect(page.getByLabel("Passwort")).toBeFocused();
  await page.keyboard.press(tabKey);
  await expect(page.getByRole("button", { name: "Anmelden" })).toBeFocused();
});

test("Login führt zur Homepage und Logout sperrt den internen Bereich", async ({
  page,
  createAccount
}) => {
  const account = await createAccount();

  await page.goto(ROUTES.login);
  await page.getByLabel("E-Mail").fill(account.email);
  await page.getByLabel("Passwort").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(ROUTES.home);
  await page.getByRole("link", { name: "Interner Bereich" }).click();
  await expect(page).toHaveURL(ROUTES.dashboard);
  await expect(page.getByRole("heading", { name: `Hallo, ${account.name}` })).toBeVisible();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(ROUTES.login);
  await page.goto(ROUTES.dashboard);
  await expect(page).toHaveURL(ROUTES.login);
});

test("ungültige Eingaben und falsche Zugangsdaten zeigen verständliche Fehler", async ({
  page,
  createAccount
}) => {
  const account = await createAccount();

  await page.goto(ROUTES.login);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByLabel("E-Mail")).toHaveAccessibleDescription(ERROR_VALIDATION.EMAIL_REQUIRED.message);
  await expect(page.getByLabel("Passwort")).toHaveAccessibleDescription(ERROR_VALIDATION.PASSWORD_REQUIRED.message);
  await page.getByLabel("E-Mail").fill(account.email);
  await page.getByLabel("Passwort").fill("Falsches Passwort");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText(ERROR_AUTH.LOGIN_FAILED.message)).toBeVisible();
  await expect(page).toHaveURL(ROUTES.login);
});

for (const route of [
  ROUTES.dashboard,
  ROUTES.admin,
  ROUTES.superAdmin,
]) {
  test(`anonymer Direktaufruf von ${route} führt zum Login`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(ROUTES.login);
  });
}

for (const role of [
  USER,
  ADMIN,
  SUPER_ADMIN,
] as const) {
  test(`serverseitige Seitenrechte für ${role}`, async ({
    page,
    createAccount
  }) => {
    const account = await createAccount({ role });

    await login(page.request, account.email);
    await page.goto(ROUTES.dashboard);
    await expect(page).toHaveURL(ROUTES.dashboard);
    await page.goto(ROUTES.admin);
    await expect(page).toHaveURL(role === USER ? ROUTES.home : ROUTES.admin);
    await page.goto(ROUTES.superAdmin);
    await expect(page).toHaveURL(role === SUPER_ADMIN ? ROUTES.superAdmin : ROUTES.home);
  });
}

for (const route of [
  ROUTES.home,
  ROUTES.login,
]) {
  test(`Barrierefreiheit und Bildschirmbreite auf ${route}`, async ({ page }) => {
    await page.goto(route);

    const results = await new AxeBuilder({ page }).withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21aa",
    ]).analyze();

    expect(results.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("der interne Bereich ist barrierefrei und passt auf den Bildschirm", async ({
  page,
  createAccount
}) => {
  const account = await createAccount({ role: SUPER_ADMIN });

  await login(page.request, account.email);
  await page.goto(ROUTES.dashboard);

  const results = await new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21aa",
  ]).analyze();

  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
