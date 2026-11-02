import {
  test as base,
  expect,
  type APIRequestContext,
} from "@playwright/test";
import {
  PrismaClient,
  type User,
} from "@prisma/client";
import {
  createHash,
  randomUUID,
} from "node:crypto";
import { hashPassword } from "@/lib/auth/password.mjs";
import {
  USER,
  type InternalRole,
} from "@/lib/auth/roles";
import { ROUTES } from "@/lib/constants/routes";
import { HTTP_STATUS } from "@/lib/http/status";
import {
  TEST_DATABASE_URL,
  TEST_PASSWORD,
} from "./environment.mjs";


type AccountOptions = {
  role?: InternalRole;
  active?: boolean;
};

type Fixtures = {
  database: PrismaClient;
  createAccount: (options?: AccountOptions) => Promise<User>;
};

export const test = base.extend<Fixtures>({
  database: async ({}, provide) => {
    const database = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });

    try {
      await provide(database);
    } finally {
      await database.$disconnect();
    }
  },
  createAccount: async ({ database }, provide) => {
    const emails: string[] = [];
    const passwordHash = await hashPassword(TEST_PASSWORD);

    try {
      await provide(async (options = {}) => {
        const email = `${randomUUID()}@example.test`;

        emails.push(email);

        return database.user.create({
          data: {
            email,
            name: "Automatisches Testkonto",
            passwordHash,
            role: options.role ?? USER,
            active: options.active ?? true,
          },
        });
      });
    } finally {
      await database.loginAttempt.deleteMany({
        where: { key: { in: emails.map(email => createHash("sha256").update(email).digest("hex")) } },
      });
      await database.user.deleteMany({ where: { email: { in: emails } } });
    }
  },
});

export async function login(request: APIRequestContext, email: string, password = TEST_PASSWORD) {
  const csrfResponse = await request.get(ROUTES.authCsrf);

  expect(csrfResponse.status()).toBe(HTTP_STATUS.OK);

  const { csrfToken } = await csrfResponse.json();

  return request.post(ROUTES.authCredentials, {
    form: {
      csrfToken,
      email,
      password,
      callbackUrl: ROUTES.home,
      json: "true",
    },
  });
}

export { expect };
