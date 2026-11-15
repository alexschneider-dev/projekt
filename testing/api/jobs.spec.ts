import {
  test,
  expect,
  login,
} from "../support/fixtures";
import { ROUTES } from "@/lib/constants/routes";
import { HTTP_STATUS } from "@/lib/http/status";
import { randomUUID } from "node:crypto";


test("Stellen-APIs benötigen eine Anmeldung", async ({ request }) => {
  expect((await request.get(ROUTES.jobsApi)).status()).toBe(HTTP_STATUS.UNAUTHORIZED);
  expect((await request.post(ROUTES.jobSearchesApi, { data: { url: "test" } })).status())
    .toBe(HTTP_STATUS.UNAUTHORIZED);
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
    const first = await request.post(ROUTES.jobSearchesApi, { data: { url: `${url}?page=2#oben` } });
    expect(first.status()).toBe(HTTP_STATUS.OK);
    expect(await first.json()).toEqual({ created: true });
    const saved = await database.jobSearch.findUniqueOrThrow({ where: { url } });
    expect(saved.active).toBe(true);
    const second = await request.post(ROUTES.jobSearchesApi, { data: { url } });
    expect(await second.json()).toEqual({ created: false });
    expect(await database.jobSearch.findUniqueOrThrow({ where: { url } })).toEqual(saved);
  } finally {
    await database.jobSearch.deleteMany({ where: { url } });
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
  await database.jobListing.createMany({ data: urls.map((url) => ({ url })) });

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
