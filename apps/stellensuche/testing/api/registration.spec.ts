import {
  test,
  expect,
  login
} from "../support/fixtures";
import { ROUTES } from "@/testing/support/routes";
import { SUPER_ADMIN } from "@/lib/auth/roles";
import { randomUUID } from "node:crypto";


test("USER darf auch gleichzeitig nur eine Suchgruppe erstellen, SUPER_ADMIN mehrere", async ({
  request,
  database,
  createAccount
}) => {
  const user = await createAccount();
  await login(request, user.email);
  const requests = await Promise.all(Array.from({ length: 3 }, () => request.post(ROUTES.jobSearchesApi, {
    data: {
      title: "Testsuche",
      url: `https://www.stepstone.de/jobs/${randomUUID()}`
    },
  })));
  expect(requests.map(response => response.status()).sort()).toEqual([
    200,
    409,
    409
  ]);
  const search = await database.jobSearch.findFirstOrThrow({ where: { userId: user.id } });
  const duplicate = await request.post(ROUTES.jobSearchesApi, {
    data: {
      title: "Duplikat",
      url: search.url
    }
  });
  expect(await duplicate.json()).toMatchObject({ created: false });
  await database.jobSearch.update({
    where: { id: search.id },
    data: { active: false }
  });
  expect((await request.post(ROUTES.jobSearchesApi, {
    data: {
      title: "Weitere",
      url: `https://www.stepstone.de/jobs/${randomUUID()}`
    },
  })).status()).toBe(409);
  const superUser = await createAccount({ role: SUPER_ADMIN });
  await login(request, superUser.email);
  for (let index = 0; index < 2; index += 1) {
    expect((await request.post(ROUTES.jobSearchesApi, {
      data: {
        title: "Weitere",
        url: `https://www.stepstone.de/jobs/${randomUUID()}`
      },
    })).status()).toBe(200);
  }
});
