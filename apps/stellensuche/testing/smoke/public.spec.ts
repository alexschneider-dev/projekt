import {
  test,
  expect,
} from "@playwright/test";
import { ROUTES } from "@/lib/constants/routes";
import { HTTP_STATUS } from "@/lib/http/status";


// Ausschließlich öffentliche Lesezugriffe; keine Testkonten oder Datenbankänderungen.
test("öffentliche Seiten und Zugriffsschutz sind erreichbar", async ({ request }) => {
  const home = await request.get(ROUTES.home);
  const login = await request.get(ROUTES.login);
  const protectedPage = await request.get(ROUTES.dashboard);
  const telemetry = await request.get(ROUTES.telemetryConfig);

  expect(home.status()).toBe(HTTP_STATUS.OK);
  expect(await home.text()).toContain("Projekt");
  expect(login.status()).toBe(HTTP_STATUS.OK);
  expect(await login.text()).toContain("Willkommen zurück");
  expect(new URL(protectedPage.url()).pathname).toBe(ROUTES.login);
  expect(telemetry.status()).toBe(HTTP_STATUS.OK);
  expect(typeof (await telemetry.json()).enabled).toBe("boolean");
});
