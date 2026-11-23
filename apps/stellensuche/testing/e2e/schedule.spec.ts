import {
  test,
  expect,
  login,
} from "../support/fixtures";
import { ROUTES } from "@/testing/support/routes";


test("Tägliche Suchzeit speichern und wieder deaktivieren", async ({
  page,
  createAccount,
}) => {
  const account = await createAccount();
  await login(page.request, account.email);
  await page.goto(ROUTES.dashboard);
  await expect(page.getByText("Automatische Suche deaktiviert – keine Uhrzeit gespeichert.")).toBeVisible();
  const time = page.getByLabel("Tägliche Suchzeit (Europe/Berlin)");
  await time.fill("10:30");
  await page.getByRole("button", { name: "Suchzeit speichern" }).click();
  await expect(page.getByText(/Nächste automatische Suche:/)).toContainText("10:30");
  await page.reload();
  await expect(time).toHaveValue("10:30");
  await time.fill("");
  await page.getByRole("button", { name: "Suchzeit speichern" }).click();
  await expect(page.getByText("Automatische Suche deaktiviert – keine Uhrzeit gespeichert.")).toBeVisible();
});
