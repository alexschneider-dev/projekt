import {
  test,
  expect,
  login,
} from "../support/fixtures";
import { SUPER_ADMIN } from "@/lib/auth/roles";
import {
  ROUTES,
  jobSearchApiHref,
  jobSearchHref,
} from "@/lib/constants/routes";
import { HTTP_STATUS } from "@/lib/http/status";


test("Benutzer sehen und bearbeiten ausschließlich ihre eigenen Daten", async ({
  request,
  createAccount,
  database,
}) => {
  const first = await createAccount();
  const other = await createAccount({ role: SUPER_ADMIN });
  const url = "https://www.stepstone.de/stellenangebote--Test--123-inline.html";
  const firstJob = await database.jobListing.create({
    data: {
      userId: first.id,
      url,
    },
  });
  const otherJob = await database.jobListing.create({
    data: {
      userId: other.id,
      url,
    },
  });
  const searchUrl = "https://www.stepstone.de/jobs/test";
  await login(request, first.email);
  expect((await request.get(ROUTES.observabilityAuth)).status()).toBe(HTTP_STATUS.FORBIDDEN);
  const dashboard = await (await request.get(ROUTES.dashboard)).text();
  expect(dashboard).toContain(`href="${ROUTES.jobs}"`);
  expect(dashboard).not.toContain(`href="${ROUTES.grafana}"`);
  expect((await request.post(ROUTES.jobSearchesApi, {
    data: {
      title: "Eigene Suche",
      url: searchUrl,
      userId: other.id,
    },
  })).status()).toBe(HTTP_STATUS.OK);
  const [search] = await (await request.get(ROUTES.jobSearchesApi)).json();
  const result = await (await request.get(ROUTES.jobsApi)).json();
  expect(result.total).toBe(1);
  expect(result.pendingTotal).toBe(1);
  expect(result.items.map((item: { id: number }) => item.id)).toEqual([firstJob.id]);
  expect((await request.patch(ROUTES.jobsApi, {
    data: {
      id: otherJob.id,
      status: "BEWORBEN"
    },
  })).status()).toBe(HTTP_STATUS.NOT_FOUND);
  expect((await request.post(ROUTES.jobsCsvApi, {
    multipart: {
      file: {
        name: "stellen.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(url),
      },
    },
  })).status()).toBe(HTTP_STATUS.OK);
  expect((await database.jobListing.findUniqueOrThrow({ where: { id: firstJob.id } })).status).toBe("BEWORBEN");
  expect((await database.jobListing.findUniqueOrThrow({ where: { id: otherJob.id } })).status).toBe("PENDING");
  expect((await request.post(ROUTES.jobsImportApi)).status()).toBe(HTTP_STATUS.OK);
  expect((await database.jobImportState.findUniqueOrThrow({ where: { userId: first.id } })).requested)
    .toBe(true);
  expect((await database.jobImportState.findUniqueOrThrow({ where: { userId: other.id } })).requested)
    .toBe(false);

  await login(request, other.email);
  expect((await request.get(ROUTES.observabilityAuth)).status()).toBe(HTTP_STATUS.NO_CONTENT);
  expect(await (await request.get(ROUTES.jobSearchesApi)).json()).toEqual([]);
  expect((await request.get(jobSearchHref(search.id))).status()).toBe(HTTP_STATUS.NOT_FOUND);
  expect((await request.patch(jobSearchApiHref(search.id), {
    data: {
      title: "Fremde Änderung",
      url: searchUrl,
    },
  })).status()).toBe(HTTP_STATUS.NOT_FOUND);
  expect((await request.patch(ROUTES.jobsApi, {
    data: {
      id: firstJob.id,
      status: "BEWORBEN"
    }
  })).status()).toBe(HTTP_STATUS.NOT_FOUND);
  expect((await (await request.get(ROUTES.jobsApi)).json()).pendingTotal).toBe(1);
  expect(await (await request.post(ROUTES.jobSearchesApi, {
    data: {
      title: "Getrennte Suche",
      url: searchUrl,
    },
  })).json()).toEqual({ created: true });
  expect((await (await request.get(ROUTES.jobsImportApi)).json()).requested).toBe(false);
});
