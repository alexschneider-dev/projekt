import {
  InternalRole,
  PrismaClient
} from "@prisma/client";
import { hashPassword } from "../lib/auth/password.mjs";
import {
  parseAccountArguments,
  readAccountPassword,
  reportAccountFailure
} from "./account-input.mjs";
import { createRequire } from "node:module";


const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const db = new PrismaClient();

try {
  const account = parseAccountArguments(
    process.argv.slice(2),
    Object.values(InternalRole),
    InternalRole.USER
  );
  const password = await readAccountPassword();
  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      ...account,
      passwordHash
    }
  });

  console.log(`Konto angelegt: ${user.email} (${user.role}), Benutzer-ID: ${user.id}`);
} catch (error) {
  reportAccountFailure(error);
} finally {
  await db.$disconnect();
}
