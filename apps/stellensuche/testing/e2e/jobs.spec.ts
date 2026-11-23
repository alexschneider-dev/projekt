import {
  test,
  expect,
  login,
} from "../support/fixtures";
import {
  ROUTES,
  jobSearchHref,
} from "@/testing/support/routes";
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
        userId: account.id,
        url: older,
        createdAt: new Date("2200-01-01T00:00:00Z"),
      },
      {
        userId: account.id,
        url: newer,
        createdAt: new Date("2201-01-02T00:00:00Z"),
      },
    ],
  });

  try {
    await page.goto(ROUTES.jobs);
    await expect(page.getByRole("heading", {
      name: "Stellen",
      exact: true,
    })).toBeVisible();
    const links = page.locator(`td a[href*="${marker}"]`);
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute("href", newer);
    await expect(links.nth(1)).toHaveAttribute("href", older);
    const row = page.getByRole("row").filter({ has: page.locator(`a[href="${newer}"]`) });
    await row.getByRole("combobox", { name: "Stellenstatus" }).selectOption("BEWORBEN");
    await expect(row.getByRole("combobox", { name: "Stellenstatus" })).toHaveValue("BEWORBEN");
    expect((await database.jobListing.findUniqueOrThrow({
      where: {
        userId_url: {
          userId: account.id,
          url: newer
        }
      }
    })).status).toBe("BEWORBEN");
    await page.reload();
    await expect(row.getByRole("combobox", { name: "Stellenstatus" })).toHaveValue("BEWORBEN");
    const filter = page.getByRole("combobox", {
      name: "Status",
      exact: true
    });
    await filter.selectOption("PENDING");
    await expect(page).toHaveURL(/status=PENDING/);
    await expect(row).toHaveCount(0);
    await filter.selectOption("BEWORBEN");
    await expect(page).toHaveURL(/status=BEWORBEN/);
    await expect(row).toBeVisible();
    await page.reload();
    await expect(filter).toHaveValue("BEWORBEN");
    await expect(row).toBeVisible();
    await page.goBack();
    await expect(filter).toHaveValue("PENDING");
    await expect(row).toHaveCount(0);
    await filter.selectOption("all");
    await expect(page).toHaveURL(ROUTES.jobs);
    await expect(row).toBeVisible();
    await row.getByRole("combobox", { name: "Stellenstatus" }).selectOption("PENDING");
    await expect(row.getByRole("combobox", { name: "Stellenstatus" })).toHaveValue("PENDING");
    await page.reload();
    await expect(row.getByRole("combobox", { name: "Stellenstatus" })).toHaveValue("PENDING");
    expect((await database.jobListing.findUniqueOrThrow({
      where: {
        userId_url: {
          userId: account.id,
          url: newer
        }
      }
    })).status).toBe("PENDING");
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
    expect(await database.jobSearch.count({
      where: {
        userId: account.id,
        url
      }
    })).toBe(1);
    await expect(page.getByRole("link", {
      name: url,
      exact: true
    })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", {
      name: url,
      exact: true
    })).toBeVisible();
    await page.getByLabel("Titel", { exact: true }).fill("Testsuche");
    await input.fill(url);
    await page.getByRole("button", { name: "Such-URL hinzufügen" }).click();
    await expect(page.getByText("Diese Such-URL ist bereits gespeichert und wurde unverändert belassen.")).toBeVisible();
  } finally {
    await database.jobSearch.deleteMany({
      where: {
        userId: account.id,
        url
      }
    });
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
      userId: account.id,
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
    const opened = page.waitForEvent("popup");
    await row.getByRole("link", { name: title }).click();
    const detailPage = await opened;
    await expect(detailPage).toHaveURL(jobSearchHref(search.id));
    await expect(detailPage.getByLabel("Titel", { exact: true })).toHaveValue(title);
    await detailPage.getByLabel("Titel", { exact: true }).fill("Geänderte Suche");
    await detailPage.getByLabel("Such-URL", { exact: true }).fill(`${search.url}?q=neu`);
    await detailPage.getByRole("button", { name: "Änderungen speichern" }).click();
    await expect(detailPage.getByText("Suche gespeichert.", { exact: true })).toBeVisible();
    await expect(detailPage.getByText("Noch nicht abgerufen", { exact: true })).toBeVisible();
    await detailPage.reload();
    await expect(detailPage.getByLabel("Titel", { exact: true })).toHaveValue("Geänderte Suche");
    await expect(detailPage.getByLabel("Such-URL", { exact: true })).toHaveValue(`${search.url}?q=neu`);
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
  await database.jobListing.createMany({
    data: urls.map((url) => ({
      url,
      userId: account.id,
    }))
  });

  try {
    await page.goto(`${ROUTES.jobs}?quelle=test`);
    await expect(page.locator("tbody tr")).toHaveCount(100);
    await page.getByRole("link", {
      name: "Seite 2",
      exact: true
    }).click();
    await expect(page).toHaveURL(/quelle=test&page=2/);
    await expect(page.getByText(/Seite 2 von/)).toBeVisible();
    await expect(page.getByRole("link", {
      name: "Seite 2",
      exact: true
    })).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(page.getByText(/Seite 2 von/)).toBeVisible();
    await expect(page.getByRole("link", {
      name: "Seite 2",
      exact: true
    })).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(page).toHaveURL(`${ROUTES.jobs}?quelle=test`);
    await expect(page.getByText(/Seite 1 von/)).toBeVisible();
    await expect(page.getByText(/Pending: [\d.]+/)).toBeVisible();
    await page.getByRole("link", {
      name: "Weiter",
      exact: true
    }).click();
    await page.getByRole("combobox", {
      name: "Status",
      exact: true
    }).selectOption("PENDING");
    await expect(page).toHaveURL(`${ROUTES.jobs}?quelle=test&status=PENDING`);
    await expect(page.getByText(/Seite 1 von/)).toBeVisible();
    await expect(page.getByText(/Pending: [\d.]+/)).toBeVisible();
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

test("CSV-Upload setzt bekannte Links auf BEWORBEN und aktualisiert den Filter", async ({
  page,
  database,
  createAccount,
}) => {
  const account = await createAccount();
  await login(page.request, account.email);
  const marker = randomUUID();
  const url = `https://www.stepstone.de/stellenangebote--${marker}-inline.html`;
  const job = await database.jobListing.create({
    data: {
      userId: account.id,
      url,
      createdAt: new Date("2400-01-01T00:00:00Z"),
    },
  });

  try {
    await page.goto(`${ROUTES.jobs}?status=PENDING`);
    await expect(page.getByRole("link", {
      name: url,
      exact: true
    })).toBeVisible();
    await page.getByLabel("CSV-Datei").setInputFiles({
      name: "stellen.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`URL\n${url}\nhttps://example.test/${marker}`),
    });
    await page.getByRole("button", { name: "CSV abgleichen" }).click();
    await expect(page.getByText(/1 neu als beworben gespeichert · 0 bereits beworben · 1 nicht gefunden/)).toBeVisible();
    await expect(page.getByRole("link", {
      name: url,
      exact: true
    })).toHaveCount(0);
    expect((await database.jobListing.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("BEWORBEN");
    await page.getByRole("combobox", {
      name: "Status",
      exact: true
    }).selectOption("BEWORBEN");
    const row = page.getByRole("row").filter({ has: page.locator(`a[href="${url}"]`) });
    await expect(row.getByRole("combobox", { name: "Stellenstatus" })).toHaveValue("BEWORBEN");
  } finally {
    await database.jobListing.delete({ where: { id: job.id } });
  }
});

test("Manueller Suchlauf zeigt Anforderung, Fortschritt und Abschluss", async ({
  page,
  createAccount,
}) => {
  const account = await createAccount();
  await login(page.request, account.email);
  let requests = 0;
  let state = {
    id: 1,
    requested: false,
    running: false,
    requestedAt: null as string | null,
    startedAt: null as string | null,
    finishedAt: null as string | null,
    succeeded: null as boolean | null,
    inserted: 0,
  };
  await page.route(`**${ROUTES.jobsImportApi}`, async (route) => {
    if (route.request().method() === "POST") {
      requests += 1;
      state = {
        ...state,
        requested: true,
        requestedAt: new Date().toISOString(),
      };
      await route.fulfill({ json: { requested: true } });
    } else {
      await route.fulfill({ json: state });
    }
  });
  await page.goto(ROUTES.jobSearches);
  await page.getByRole("button", { name: "Alle Suchgruppen jetzt durchsuchen" }).click();
  await expect(page.getByRole("button", { name: "Suche angefordert …" })).toBeDisabled();
  expect(requests).toBe(1);
  state = {
    ...state,
    requested: false,
    running: true,
    startedAt: new Date().toISOString(),
  };
  await expect(page.getByRole("button", { name: "Suche läuft …" })).toBeDisabled();
  state = {
    ...state,
    running: false,
    succeeded: true,
    finishedAt: new Date().toISOString(),
    inserted: 2,
  };
  await expect(page.getByText("Letzter Durchlauf abgeschlossen: 2 neue Stellen.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Alle Suchgruppen jetzt durchsuchen" })).toBeEnabled();
});

test("Suchgruppe in der Tabelle deaktivieren, neu laden und wieder aktivieren", async ({
  page,
  database,
  createAccount,
}) => {
  const account = await createAccount();
  const search = await database.jobSearch.create({
    data: {
      userId: account.id,
      title: "Aktivität umschalten",
      url: `https://www.stepstone.de/jobs/test-${randomUUID()}`,
    },
  });
  await login(page.request, account.email);
  await page.goto(ROUTES.jobSearches);
  const row = page.getByRole("row").filter({ hasText: search.title });
  await row.getByRole("button", {
    name: "Deaktivieren",
    exact: true
  }).click();
  await expect(row.getByRole("cell", {
    name: "Inaktiv",
    exact: true
  })).toBeVisible();
  await expect(row.getByRole("button", {
    name: "Aktivieren",
    exact: true
  })).toBeEnabled();
  await page.reload();
  await expect(row.getByRole("cell", {
    name: "Inaktiv",
    exact: true
  })).toBeVisible();
  await row.getByRole("button", {
    name: "Aktivieren",
    exact: true
  }).click();
  await expect(row.getByRole("cell", {
    name: "Aktiv",
    exact: true
  })).toBeVisible();
  expect((await database.jobSearch.findUniqueOrThrow({ where: { id: search.id } })).active).toBe(true);
});

test("Unvollständige Suchgruppe zeigt erfasste Seiten und Treffer nach Neuladen", async ({
  page,
  database,
  createAccount,
}) => {
  const account = await createAccount();
  await database.jobSearch.create({
    data: {
      userId: account.id,
      title: "Teilweise erfasst",
      url: `https://www.stepstone.de/jobs/test-${randomUUID()}`,
      lastResultCount: 266,
      lastScannedCount: 150,
      lastScannedPages: 6,
      lastTotalPages: 11,
      lastScanComplete: false,
      lastFetchedAt: new Date(),
    },
  });
  await login(page.request, account.email);
  await page.goto(ROUTES.jobSearches);
  await page.reload();
  const row = page.getByRole("row").filter({ hasText: "Teilweise erfasst" });
  await expect(row).toContainText("150 von 266 Treffern erfasst");
  await expect(row).toContainText("6 von 11 Seiten erfasst");
  await expect(row).toContainText("Unvollständig");
});

test("Laufende Hauptsuche stoppen und den bestätigten Stopp anzeigen", async ({
  page,
  database,
  createAccount,
}) => {
  const account = await createAccount();
  await database.jobImportState.update({
    where: { userId: account.id },
    data: { running: true },
  });
  await login(page.request, account.email);
  await page.goto(ROUTES.jobSearches);
  await page.getByRole("button", {
    name: "Suche stoppen",
    exact: true
  }).click();
  await expect(page.getByRole("button", { name: "Wird gestoppt …" })).toBeDisabled();
  expect((await database.jobImportState.findUniqueOrThrow({ where: { userId: account.id } })).stopRequested).toBe(true);
  await database.jobImportState.update({
    where: { userId: account.id },
    data: {
      running: false,
      stopRequested: false,
      stopped: true,
      succeeded: false,
      finishedAt: new Date(),
      inserted: 3,
    },
  });
  await expect(page.getByText("Suche gestoppt. 3 neue Stellen wurden bis dahin gespeichert.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Alle Suchgruppen jetzt durchsuchen" })).toBeEnabled();
  await page.reload();
  await expect(page.getByText("Suche gestoppt. 3 neue Stellen wurden bis dahin gespeichert.")).toBeVisible();
});
