import {
  test,
  expect,
  login,
} from "../support/fixtures";
import { randomUUID } from "node:crypto";
import { ROUTES } from "@/lib/constants/routes";
import { HTTP_STATUS } from "@/lib/http/status";


function upload(content: string) {
  return {
    multipart: {
      file: {
        name: "stellen.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(content),
      },
    },
  };
}

test("CSV-Markierung benötigt eine Anmeldung", async ({ request }) => {
  expect((await request.post(ROUTES.jobsCsvApi, upload("URL"))).status()).toBe(HTTP_STATUS.UNAUTHORIZED);
});

test("CSV markiert nur vorhandene Stellen und verarbeitet ungültige Dateien ohne Änderungen", async ({
  request,
  database,
  createAccount,
}) => {
  const account = await createAccount();
  await login(request, account.email);
  const marker = randomUUID();
  const fresh = `https://www.stepstone.de/stellenangebote--${marker}-1-inline.html`;
  const marked = `https://www.stepstone.de/stellenangebote--${marker}-2-inline.html`;
  const unknown = `https://www.stepstone.de/stellenangebote--${marker}-3-inline.html`;
  await database.jobListing.createMany({
    data: [
      {
        url: fresh,
        userId: account.id
      },
      {
        userId: account.id,
        url: marked,
        isMarkiert: true,
      },
    ],
  });

  try {
    expect((await request.post(ROUTES.jobsCsvApi, upload(`${fresh}\nungültig`))).status())
      .toBe(HTTP_STATUS.BAD_REQUEST);
    expect((await database.jobListing.findUniqueOrThrow({
      where: {
        userId_url: {
          userId: account.id,
          url: fresh
        }
      }
    })).isMarkiert).toBe(false);
    const csv = `URL\n"${fresh}?tracking=1"\n${fresh}\n${marked}\n${unknown}`;
    const response = await request.post(ROUTES.jobsCsvApi, upload(csv));
    expect(response.status()).toBe(HTTP_STATUS.OK);
    expect(await response.json()).toEqual({
      marked: 1,
      alreadyMarked: 1,
      notFound: 1,
      duplicates: 1,
    });
    expect((await database.jobListing.findUniqueOrThrow({
      where: {
        userId_url: {
          userId: account.id,
          url: fresh
        }
      }
    })).isMarkiert).toBe(true);
    expect(await database.jobListing.findUnique({
      where: {
        userId_url: {
          userId: account.id,
          url: unknown
        }
      }
    })).toBeNull();
    const repeated = await request.post(ROUTES.jobsCsvApi, upload(csv));
    expect(await repeated.json()).toMatchObject({
      marked: 0,
      alreadyMarked: 2,
    });
  } finally {
    await database.jobListing.deleteMany({ where: { url: { contains: marker } } });
  }
});
