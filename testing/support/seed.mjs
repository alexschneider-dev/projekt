import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../lib/auth/password.mjs";
import {
  USER,
  ADMIN,
  SUPER_ADMIN,
} from "../../lib/auth/roles.ts";
import {
  TEST_DATABASE_URL,
  TEST_PASSWORD,
  assertTestDatabase,
} from "./environment.mjs";


assertTestDatabase(process.env.DATABASE_URL);

const prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
const accounts = [
  {
    email: "user@example.test",
    name: "Test Benutzer",
    role: USER,
    active: true,
  },
  {
    email: "admin@example.test",
    name: "Test Administration",
    role: ADMIN,
    active: true,
  },
  {
    email: "super-admin@example.test",
    name: "Test Super-Administration",
    role: SUPER_ADMIN,
    active: true,
  },
  {
    email: "inaktiv@example.test",
    name: "Inaktives Testkonto",
    role: USER,
    active: false,
  },
];

try {
  const passwordHash = await hashPassword(TEST_PASSWORD);

  for (const account of accounts) {
    const data = {
      ...account,
      passwordHash,
      sessionVersion: 0,
    };

    await prisma.user.upsert({
      where: { email: account.email },
      create: data,
      update: data,
    });
  }

  await prisma.loginAttempt.deleteMany({
    where: {
      key: { in: accounts.map(account => createHash("sha256").update(account.email).digest("hex")) },
    },
  });

  console.log("Vier lokale Testkonten wurden vorbereitet.");
} finally {
  await prisma.$disconnect();
}
