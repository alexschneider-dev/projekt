import {
  test,
  expect,
  login,
} from "../support/fixtures";
import { ROUTES } from "@/testing/support/routes";
import { HTTP_STATUS } from "@/lib/http/status";


test("Manueller Import ist geschützt und fasst gleichzeitige Anfragen zusammen", async ({
  request,
  database,
  createAccount,
}) => {
  expect((await request.get(ROUTES.jobsImportApi)).status()).toBe(HTTP_STATUS.UNAUTHORIZED);
  expect((await request.post(ROUTES.jobsImportApi)).status()).toBe(HTTP_STATUS.UNAUTHORIZED);
  const account = await createAccount();
  await login(request, account.email);
  const before = await database.jobImportState.findUniqueOrThrow({ where: { userId: account.id } });

  try {
    await database.jobImportState.update({
      where: { userId: account.id },
      data: {
        requested: false,
        running: false,
      },
    });
    const responses = await Promise.all(Array.from({ length: 3 }, () => request.post(ROUTES.jobsImportApi)));
    const bodies = await Promise.all(responses.map((response) => response.json()));
    expect(bodies.filter((body) => body.requested)).toHaveLength(1);
    const state = await (await request.get(ROUTES.jobsImportApi)).json();
    expect(state.requested).toBe(true);
    expect(state.running).toBe(false);
    expect(state.requestedAt).not.toBeNull();
    await database.jobImportState.update({
      where: { userId: account.id },
      data: {
        requested: false,
        running: true,
      },
    });
    expect(await (await request.post(ROUTES.jobsImportApi)).json()).toEqual({ requested: false });
  } finally {
    await database.jobImportState.update({
      where: { userId: account.id },
      data: before,
    });
  }
});

test("Stoppauftrag ist geschützt und betrifft nur den eigenen laufenden Import", async ({
  request,
  database,
  createAccount,
}) => {
  expect((await request.delete(ROUTES.jobsImportApi)).status()).toBe(HTTP_STATUS.UNAUTHORIZED);
  const own = await createAccount();
  const other = await createAccount();
  await database.jobImportState.updateMany({
    where: {
      userId: {
        in: [
          own.id,
          other.id
        ]
      }
    },
    data: { running: true },
  });
  await login(request, own.email);
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(await (await request.delete(ROUTES.jobsImportApi)).json()).toEqual({ stopRequested: true });
  }
  expect((await database.jobImportState.findUniqueOrThrow({ where: { userId: own.id } })).stopRequested).toBe(true);
  expect((await database.jobImportState.findUniqueOrThrow({ where: { userId: other.id } })).stopRequested).toBe(false);
  expect(await (await request.post(ROUTES.jobsImportApi)).json()).toEqual({ requested: false });
  await database.jobImportState.update({
    where: { userId: own.id },
    data: {
      running: false,
      stopped: true,
      stopRequested: false,
    },
  });
  expect(await (await request.delete(ROUTES.jobsImportApi)).json()).toEqual({ stopRequested: false });
  expect(await (await request.post(ROUTES.jobsImportApi)).json()).toEqual({ requested: true });
  expect((await database.jobImportState.findUniqueOrThrow({ where: { userId: own.id } })).stopped).toBe(false);
});
