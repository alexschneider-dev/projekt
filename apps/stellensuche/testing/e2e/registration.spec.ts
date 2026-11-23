import {
  test,
  expect
} from "../support/fixtures";
import {
  randomBytes,
  randomUUID,
  createHash
} from "node:crypto";
import { hashPassword } from "@/lib/auth/password.mjs";
import { ROUTES } from "@/testing/support/routes";
import { USER } from "@/lib/auth/roles";
import { TEST_PASSWORD } from "../support/environment.mjs";


test("Bestätigungslink öffnet ein USER-Konto und ermöglicht die Anmeldung", async ({
  page,
  database
}) => {
  const email = `${randomUUID()}@example.test`;
  const token = randomBytes(32).toString("hex");
  await database.pendingRegistration.create({
    data: {
      email,
      passwordHash: await hashPassword(TEST_PASSWORD),
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  try {
    await page.goto(`${ROUTES.verifyEmail}#${token}`);
    await page.getByRole("button", { name: "E-Mail bestätigen" }).click();
    await expect(page.getByRole("status")).toContainText("Du kannst dich jetzt anmelden");
    expect((await database.user.findUniqueOrThrow({ where: { email } })).role).toBe(USER);
    await page.getByRole("link", { name: "Zur Anmeldung" }).click();
    await page.getByLabel("E-Mail", { exact: true }).fill(email);
    await page.getByLabel("Passwort", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", {
      name: "Anmelden",
      exact: true
    }).click();
    await expect(page).toHaveURL(ROUTES.home);
    await page.goto(ROUTES.jobSearches);
    await expect(page.getByRole("heading", {
      name: "Such-URLs",
      exact: true
    })).toBeVisible();
    await expect(page.getByRole("link", {
      name: "Monitoring",
      exact: true
    })).toHaveCount(0);
  } finally {
    await page.close();
    await database.pendingRegistration.deleteMany({ where: { email } });
    await database.jobImportState.deleteMany({ where: { user: { email } } });
    await database.user.deleteMany({ where: { email } });
    await database.loginAttempt.deleteMany({ where: { key: createHash("sha256").update(email).digest("hex") } });
  }
});

test("Registrierungsseite ist öffentlich und prüft die Passwortlänge", async ({ page }) => {
  await page.goto(ROUTES.home);
  await page.getByRole("link", {
    name: "Registrieren",
    exact: true
  }).click();
  await page.getByLabel("E-Mail", { exact: true }).fill("test@example.test");
  await page.getByLabel("Passwort (12 bis 128 Zeichen)").fill("kurz");
  await page.getByRole("button", {
    name: "Registrieren",
    exact: true
  }).click();
  await expect(page.getByText("Das Passwort muss 12 bis 128 Zeichen enthalten.", { exact: true })).toBeVisible();
});
