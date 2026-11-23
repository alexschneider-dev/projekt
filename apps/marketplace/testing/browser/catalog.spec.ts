import {
  test,
  expect
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";


test("Katalog, URL-Filter und Produktseite", async ({ page }, info) => {
  await page.goto(".");
  await expect(page.getByRole("heading", { name: "Ein guter Platz zum Bleiben." })).toBeVisible();
  if (info.project.name === "mobil") await page.getByText("Filtern und sortieren", { exact: true }).click();
  const filters =
    info.project.name === "mobil"
      ? page.locator("details").filter({ hasText: "Filtern und sortieren" })
      : page.getByRole("complementary");
  await filters.getByLabel("Material", { exact: true }).selectOption("Holz");
  await filters.getByRole("button", { name: "Produkte anzeigen" }).click();
  await expect(page).toHaveURL(/material=Holz/);
  await page.locator("article a").first().click();
  await expect(page.getByRole("heading", { name: "Angebote vergleichen" })).toBeVisible();
  await expect(page).toHaveURL(/produkte\/stuhl-/);
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("produkt.png"),
    fullPage: true
  });
});

test("Mobile Navigation und geschützter Kontobereich", async ({ page }, info) => {
  await page.goto("konto");
  await expect(page).toHaveURL(/login/);
  await expect(page.getByLabel("E-Mail", { exact: true })).toBeVisible();
  await page.goto(".");
  if (info.project.name === "mobil") await page.getByLabel("Menü öffnen").click();
  await page.getByRole("link", {
    name: "Registrieren",
    exact: true
  }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Konto erstellen" })).toBeVisible();
});
