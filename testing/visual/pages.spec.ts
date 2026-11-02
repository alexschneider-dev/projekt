import {
  test,
  expect,
} from "@playwright/test";
import { ROUTES } from "@/lib/constants/routes";


for (const width of [
  390,
  1280,
]) {
  for (const route of [
    ROUTES.home,
    ROUTES.login,
  ]) {
    test(`Ansicht ${route} bei ${width} Pixeln`, async ({ page }) => {
      await page.setViewportSize({
        width,
        height: 900,
      });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${route === ROUTES.home ? "homepage" : "login"}-${width}.png`, {
        fullPage: true,
        animations: "disabled",
      });
    });
  }
}
