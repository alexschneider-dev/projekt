import {
  test,
  expect,
  login,
} from "../support/fixtures";
import {
  ROUTES,
  jobSearchHref,
} from "@/lib/constants/routes";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";
import { randomUUID } from "node:crypto";


// Fachtests mit Netzwerk-Mocks dürfen nicht vom Service Worker umgangen werden.
test.use({ serviceWorkers: "block" });

test("Stellen sind geschützt und neue Links stehen zuerst", async ({
  page,
  database,
  createAccount,
}, testInfo) => {
  await page.goto(ROUTES.jobs);
  await expect(page).toHaveURL(new RegExp(ROUTES.login));
  await page.goto(ROUTES.jobSearches);
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
        createdAt: new Date("2200-01-01T00:00:00Z"),
      },
      {
        url: newer,
        createdAt: new Date("2201-01-02T00:00:00Z"),
      },
    ],
  });

  try {
    await page.goto(ROUTES.jobs);
    await expect(page.getByRole("heading", { name: "Stellen" })).toBeVisible();
    const links = page.locator(`td a[href*="${marker}"]`);
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute("href", newer);
    await expect(links.nth(1)).toHaveAttribute("href", older);
    const row = page.getByRole("row").filter({ has: page.locator(`a[href="${newer}"]`) });
    await row.getByRole("button", { name: "Markieren", exact: true }).click();
    await expect(row.getByRole("button", { name: "Markiert", exact: true })).toBeDisabled();
    expect((await database.jobListing.findUniqueOrThrow({ where: { url: newer } })).isMarkiert).toBe(true);
    await page.reload();
    await expect(row.getByRole("button", { name: "Markiert", exact: true })).toBeDisabled();
    const filter = page.getByRole("combobox", { name: "Markierung" });
    await filter.selectOption("false");
    await expect(page).toHaveURL(/isMarkiert=false/);
    await expect(row).toHaveCount(0);
    await filter.selectOption("true");
    await expect(page).toHaveURL(/isMarkiert=true/);
    await expect(row).toBeVisible();
    await page.reload();
    await expect(filter).toHaveValue("true");
    await expect(row).toBeVisible();
    await page.goBack();
    await expect(filter).toHaveValue("false");
    await expect(row).toHaveCount(0);
    await filter.selectOption("all");
    await expect(page).toHaveURL(ROUTES.jobs);
    await expect(row).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("stellen.png") });
  } finally {
    await database.jobListing.deleteMany({ where: { url: { in: urls } } });
  }
});

test("Suchformular speichert und zeigt Feldfehler sowie doppelte URLs", async ({
  page,
  database,
  createAccount,
}) => {
  const account = await createAccount();
  await login(page.request, account.email);
  const url = `https://www.stepstone.de/jobs/test-${randomUUID()}`;

  try {
    await page.goto(ROUTES.jobSearches);
    const input = page.getByLabel("Neue Such-URL");
    await page.getByLabel("Titel", { exact: true }).fill("Testsuche");
    await input.fill("keine-url");
    await page.getByRole("button", { name: "Such-URL hinzufügen" }).click();
    await expect(page.getByText("Bitte gib eine gültige HTTPS-Such-URL der unterstützten Jobbörse ein.")).toBeVisible();
    await input.fill("https://example.org/jobs/test");
    await page.getByRole("button", { name: "Such-URL hinzufügen" }).click();
    await expect(page.getByText("Bitte gib eine gültige HTTPS-Such-URL der unterstützten Jobbörse ein.")).toBeVisible();
    await input.fill(url);
    await page.getByRole("button", { name: "Such-URL hinzufügen" }).click();
    await expect(page.getByText("Such-URL gespeichert. Sie wird beim nächsten Import berücksichtigt.")).toBeVisible();
    expect(await database.jobSearch.count({ where: { url } })).toBe(1);
    await expect(page.getByRole("link", { name: url, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", { name: url, exact: true })).toBeVisible();
    await page.getByLabel("Titel", { exact: true }).fill("Testsuche");
    await input.fill(url);
    await page.getByRole("button", { name: "Such-URL hinzufügen" }).click();
    await expect(page.getByText("Diese Such-URL ist bereits gespeichert und wurde unverändert belassen.")).toBeVisible();
  } finally {
    await database.jobSearch.deleteMany({ where: { url } });
  }
});

test("Suchverwaltung zeigt den letzten Abruf und speichert Titel und URL", async ({
  page,
  database,
  createAccount,
}, testInfo) => {
  const account = await createAccount();
  await login(page.request, account.email);
  const title = `Suche ${randomUUID()}`;
  const search = await database.jobSearch.create({
    data: {
      title,
      url: `https://www.stepstone.de/jobs/${randomUUID()}`,
      lastResultCount: 55,
      lastFetchedAt: new Date("2026-11-15T10:00:00Z"),
    },
  });

  try {
    await page.goto(ROUTES.jobSearches);
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("55 Treffer");
    await page.screenshot({ path: testInfo.outputPath("such-urls.png") });
    await row.getByRole("link", { name: title }).click();
    await expect(page).toHaveURL(jobSearchHref(search.id));
    await expect(page.getByLabel("Titel", { exact: true })).toHaveValue(title);
    await page.getByLabel("Titel", { exact: true }).fill("Geänderte Suche");
    await page.getByLabel("Such-URL", { exact: true }).fill(`${search.url}?q=neu`);
    await page.getByRole("button", { name: "Änderungen speichern" }).click();
    await expect(page.getByText("Suche gespeichert.", { exact: true })).toBeVisible();
    await expect(page.getByText("Noch nicht abgerufen", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Titel", { exact: true })).toHaveValue("Geänderte Suche");
    await expect(page.getByLabel("Such-URL", { exact: true })).toHaveValue(`${search.url}?q=neu`);
    expect((await database.jobSearch.findUniqueOrThrow({ where: { id: search.id } })).lastResultCount).toBeNull();
  } finally {
    await database.jobSearch.delete({ where: { id: search.id } });
  }
});

test("Tabellenpagination bleibt nach Neuladen und Browser-Zurück erhalten", async ({
  page,
  database,
  createAccount,
}) => {
  const account = await createAccount();
  await login(page.request, account.email);
  const marker = randomUUID();
  const urls = Array.from({ length: 101 }, (_, index) => `https://example.test/jobs/${marker}/${index}`);
  await database.jobListing.createMany({ data: urls.map((url) => ({ url })) });

  try {
    await page.goto(`${ROUTES.jobs}?quelle=test`);
    await expect(page.locator("tbody tr")).toHaveCount(100);
    await page.getByRole("button", { name: "Weiter", exact: true }).click();
    await expect(page).toHaveURL(/quelle=test&page=2/);
    await expect(page.getByText(/Seite 2 von/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Seite 2 von/)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(`${ROUTES.jobs}?quelle=test`);
    await expect(page.getByText(/Seite 1 von/)).toBeVisible();
    await page.getByRole("button", { name: "Weiter", exact: true }).click();
    await page.getByRole("combobox", { name: "Markierung" }).selectOption("false");
    await expect(page).toHaveURL(`${ROUTES.jobs}?quelle=test&isMarkiert=false`);
    await expect(page.getByText(/Seite 1 von/)).toBeVisible();
  } finally {
    await database.jobListing.deleteMany({ where: { url: { in: urls } } });
  }
});


test("API-Fehler erscheinen als schließbare Benachrichtigung", async ({
  page,
  createAccount,
}) => {
  const account = await createAccount();
  await login(page.request, account.email);
  await page.route(`**${ROUTES.jobSearchesApi}`, (route) => {
    if (route.request().method() !== "POST") return route.continue();

    return route.fulfill({
      status: ERROR_JOBS.SAVE_FAILED.status,
      contentType: "application/json",
      body: JSON.stringify({
        code: ERROR_JOBS.SAVE_FAILED.code,
        error: ERROR_JOBS.SAVE_FAILED.message,
      }),
    });
  });

  // Verzögertes JavaScript darf keine Eingabe vor der Formularinitialisierung zulassen.
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  const input = page.getByLabel("Neue Such-URL");
  const submit = page.getByRole("button", { name: "Such-URL hinzufügen" });

  try {
    await page.goto(ROUTES.jobSearches, { waitUntil: "commit" });
    await expect(input).toBeVisible();
    await expect(input).toBeDisabled();
    await expect(submit).toBeDisabled();
  } finally {
    releaseScripts();
  }

  await page.getByLabel("Titel", { exact: true }).fill("Testsuche");
  await input.fill("https://www.stepstone.de/jobs/typescript");
  await expect(input).toHaveValue("https://www.stepstone.de/jobs/typescript");
  const failureResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === ROUTES.jobSearchesApi && response.request().method() === "POST"
  );
  await submit.click();
  expect((await failureResponse).status()).toBe(ERROR_JOBS.SAVE_FAILED.status);

  const toast = page.locator('[role="alertdialog"]');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(ERROR_JOBS.SAVE_FAILED.message);
  await toast.getByLabel("Meldung schließen").click();
  await expect(toast).not.toBeVisible();
});
