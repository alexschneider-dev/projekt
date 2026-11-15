import {
  test,
  expect,
  login,
} from "../support/fixtures";
import { ROUTES } from "@/lib/constants/routes";
import { randomUUID } from "node:crypto";


test("Stellen sind geschützt und neue Links stehen zuerst", async ({
  page,
  database,
  createAccount,
}) => {
  await page.goto(ROUTES.jobs);
  await expect(page).toHaveURL(new RegExp(ROUTES.login));

  const account = await createAccount();
  await login(page.request, account.email);
  const marker = randomUUID();
  const older = `https://www.stepstone.de/stellenangebote--Alt-${marker}.html`;
  const newer = `https://www.stepstone.de/stellenangebote--Neu-${marker}.html`;
  const urls = [
    older,
    newer,
  ];
  await database.jobListing.createMany({
    data: [
      {
        url: older,
        createdAt: new Date("2025-01-01T00:00:00Z"),
      },
      {
        url: newer,
        createdAt: new Date("2025-01-02T00:00:00Z"),
      },
    ],
  });

  try {
    await page.goto(ROUTES.jobs);
    await expect(page.getByRole("heading", { name: "Stellen" })).toBeVisible();
    const links = page.locator(`li a[href*="${marker}"]`);
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute("href", newer);
    await expect(links.nth(1)).toHaveAttribute("href", older);
  } finally {
    await database.jobListing.deleteMany({ where: { url: { in: urls } } });
  }
});
