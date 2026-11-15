import {
  test,
  expect,
  login,
} from "../support/fixtures";
import {
  ROUTES,
  jobSearchApiHref,
} from "@/lib/constants/routes";
import { HTTP_STATUS } from "@/lib/http/status";
import { randomUUID } from "node:crypto";


test("Stellen-APIs benötigen eine Anmeldung", async ({ request }) => {
  expect((await request.get(ROUTES.jobsApi)).status()).toBe(HTTP_STATUS.UNAUTHORIZED);
  expect((await request.patch(ROUTES.jobsApi, { data: { id: 1 } })).status()).toBe(HTTP_STATUS.UNAUTHORIZED);
  expect((await request.get(ROUTES.jobSearchesApi)).status()).toBe(HTTP_STATUS.UNAUTHORIZED);
  expect((await request.patch(jobSearchApiHref(1), { data: {} })).status()).toBe(HTTP_STATUS.UNAUTHORIZED);
  expect((await request.post(ROUTES.jobSearchesApi, { data: { url: "test" } })).status())
    .toBe(HTTP_STATUS.UNAUTHORIZED);
});

test("Suche bearbeiten: Titel erhält Abrufwerte, eine neue URL setzt sie zurück", async ({
  request,
  database,
  createAccount,
}) => {
  const account = await createAccount();
  await login(request, account.email);
  const search = await database.jobSearch.create({
    data: {
      userId: account.id,
      title: "Bisheriger Titel",
      url: `https://www.stepstone.de/jobs/${randomUUID()}`,
      lastResultCount: 55,
      lastFetchedAt: new Date("2026-11-15T10:00:00Z"),
    },
  });

  try {
    const endpoint = jobSearchApiHref(search.id);
    expect((await request.patch(endpoint, {
      data: {
        title: "",
        url: search.url
      }
    })).status())
      .toBe(HTTP_STATUS.BAD_REQUEST);
    const renamed = await request.patch(endpoint, {
      data: {
        title: "Neuer Titel",
        url: search.url
      }
    });
    expect(renamed.status()).toBe(HTTP_STATUS.OK);
    expect(await renamed.json()).toMatchObject({
      title: "Neuer Titel",
      lastResultCount: 55,
      lastFetchedAt: "2026-11-15T10:00:00.000Z",
    });
    const edited = await request.patch(endpoint, {
      data: {
        title: "Neue Suche",
        url: `${search.url}?q=neu&page=2`,
      },
    });
    expect(edited.status()).toBe(HTTP_STATUS.OK);
    expect(await edited.json()).toMatchObject({
      title: "Neue Suche",
      url: `${search.url}?q=neu`,
      lastResultCount: null,
      lastFetchedAt: null,
    });
  } finally {
    await database.jobSearch.delete({ where: { id: search.id } });
  }
});

test("Stellen werden dauerhaft und wiederholt ohne Umschalten markiert", async ({
  request,
  database,
  createAccount,
}) => {
  const account = await createAccount();
  await login(request, account.email);
  const job = await database.jobListing.create({
    data: {
      userId: account.id,
      url: `https://example.test/jobs/${randomUUID()}`,
      createdAt: new Date("2300-01-01T00:00:00Z"),
    },
  });

  try {
    expect(job.isMarkiert).toBe(false);
    const unmarked = await (await request.get(`${ROUTES.jobsApi}?isMarkiert=false`)).json();
    expect(unmarked.unmarkedTotal).toBe(unmarked.total);
    expect(unmarked.items).toContainEqual({
      id: job.id,
      url: job.url,
      isMarkiert: false,
    });
    expect(unmarked.items.every((item: { isMarkiert: boolean }) => !item.isMarkiert)).toBe(true);
    expect((await request.get(`${ROUTES.jobsApi}?isMarkiert=invalid`)).status()).toBe(HTTP_STATUS.BAD_REQUEST);
    expect((await request.patch(ROUTES.jobsApi, { data: { id: -1 } })).status()).toBe(HTTP_STATUS.BAD_REQUEST);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request.patch(ROUTES.jobsApi, { data: { id: job.id } });
      expect(response.status()).toBe(HTTP_STATUS.OK);
      expect(await response.json()).toEqual({
        id: job.id,
        url: job.url,
        isMarkiert: true,
      });
    }
    expect((await database.jobListing.findUniqueOrThrow({ where: { id: job.id } })).isMarkiert).toBe(true);
    const marked = await (await request.get(`${ROUTES.jobsApi}?isMarkiert=true`)).json();
    expect(Number.isInteger(marked.unmarkedTotal)).toBe(true);
    expect(marked.unmarkedTotal).toBeGreaterThanOrEqual(0);
    expect(marked.items).toContainEqual({
      id: job.id,
      url: job.url,
      isMarkiert: true,
    });
    expect(marked.items.every((item: { isMarkiert: boolean }) => item.isMarkiert)).toBe(true);
    expect(marked.pageCount).toBe(Math.max(1, Math.ceil(marked.total / marked.pageSize)));
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request.patch(ROUTES.jobsApi, {
        data: {
          id: job.id,
          isMarkiert: false,
        },
      });
      expect(response.status()).toBe(HTTP_STATUS.OK);
      expect((await response.json()).isMarkiert).toBe(false);
    }
    expect((await database.jobListing.findUniqueOrThrow({ where: { id: job.id } })).isMarkiert).toBe(false);
  } finally {
    await database.jobListing.delete({ where: { id: job.id } });
  }
});

test("Such-URL validieren, normalisieren und ohne Duplikate speichern", async ({
  request,
  database,
  createAccount,
}) => {
  const account = await createAccount();
  await login(request, account.email);
  const url = `https://www.stepstone.de/jobs/test-${randomUUID()}`;

  try {
    expect((await request.post(ROUTES.jobSearchesApi, { data: { url: "keine-url" } })).status())
      .toBe(HTTP_STATUS.BAD_REQUEST);
    expect((await request.post(ROUTES.jobSearchesApi, { data: { url: "https://example.org/jobs/test" } })).status())
      .toBe(HTTP_STATUS.BAD_REQUEST);
    const first = await request.post(ROUTES.jobSearchesApi, {
      data: {
        title: "Testsuche",
        url: `${url}?page=2#oben`
      }
    });
    expect(first.status()).toBe(HTTP_STATUS.OK);
    expect(await first.json()).toEqual({ created: true });
    const saved = await database.jobSearch.findUniqueOrThrow({
      where: {
        userId_url: {
          userId: account.id,
          url
        }
      }
    });
    expect(saved.active).toBe(true);
    const second = await request.post(ROUTES.jobSearchesApi, {
      data: {
        title: "Testsuche",
        url
      }
    });
    expect(await second.json()).toEqual({ created: false });
    expect(await database.jobSearch.findUniqueOrThrow({
      where: {
        userId_url: {
          userId: account.id,
          url
        }
      }
    })).toEqual(saved);
    await database.jobSearch.update({
      where: {
        userId_url: {
          userId: account.id,
          url
        }
      },
      data: { active: false },
    });
    const searches = await request.get(ROUTES.jobSearchesApi);
    expect(searches.status()).toBe(HTTP_STATUS.OK);
    expect(await searches.json()).toContainEqual({
      id: saved.id,
      title: "Testsuche",
      lastResultCount: null,
      lastFetchedAt: null,
      url,
      active: false,
    });
  } finally {
    await database.jobSearch.deleteMany({
      where: {
        userId: account.id,
        url
      }
    });
  }
});

test("Stellen-API paginiert mit 100 Einträgen und prüft Seitennummern", async ({
  request,
  database,
  createAccount,
}) => {
  const account = await createAccount();
  await login(request, account.email);
  const marker = randomUUID();
  const urls = Array.from({ length: 101 }, (_, index) => `https://example.test/jobs/${marker}/${index}`);
  await database.jobListing.createMany({
    data: urls.map((url) => ({
      url,
      userId: account.id,
    }))
  });

  try {
    const first = await request.get(ROUTES.jobsApi);
    expect(first.status()).toBe(HTTP_STATUS.OK);
    const firstData = await first.json();
    expect(firstData.items).toHaveLength(100);
    expect(firstData.pageSize).toBe(100);
    const second = await (await request.get(`${ROUTES.jobsApi}?page=2`)).json();
    expect(second.items.length).toBeGreaterThan(0);
    const firstIds = new Set(firstData.items.map((item: { id: number }) => item.id));
    expect(second.items.every((item: { id: number }) => !firstIds.has(item.id))).toBe(true);
    expect((await request.get(`${ROUTES.jobsApi}?page=0`)).status()).toBe(HTTP_STATUS.BAD_REQUEST);
    const last = await (await request.get(`${ROUTES.jobsApi}?page=1000000`)).json();
    expect(last.page).toBe(last.pageCount);
  } finally {
    await database.jobListing.deleteMany({ where: { url: { in: urls } } });
  }
});

test("Suchgruppen lassen sich ohne Verlust der Abrufdaten deaktivieren und wieder aktivieren", async ({
  request,
  database,
  createAccount,
}) => {
  const account = await createAccount();
  const other = await createAccount();
  const search = await database.jobSearch.create({
    data: {
      userId: account.id,
      title: "Umschaltbare Suche",
      url: `https://www.stepstone.de/jobs/test-${randomUUID()}`,
      lastResultCount: 55,
      lastFetchedAt: new Date(),
    },
  });
  const endpoint = jobSearchApiHref(search.id);
  await login(request, other.email);
  expect((await request.patch(endpoint, { data: { active: false } })).status()).toBe(HTTP_STATUS.NOT_FOUND);
  await login(request, account.email);
  expect((await request.patch(endpoint, { data: { active: "false" } })).status()).toBe(HTTP_STATUS.BAD_REQUEST);
  expect((await request.patch(endpoint, { data: {} })).status()).toBe(HTTP_STATUS.BAD_REQUEST);

  for (const active of [
    false,
    false,
    true,
    true,
  ]) {
    const response = await request.patch(endpoint, { data: { active } });
    expect(response.status()).toBe(HTTP_STATUS.OK);
    expect(await response.json()).toMatchObject({
      active,
      title: search.title,
      url: search.url,
      lastResultCount: 55,
      lastFetchedAt: search.lastFetchedAt!.toISOString(),
    });
    expect((await database.jobSearch.findUniqueOrThrow({ where: { id: search.id } })).active).toBe(active);
  }
});
