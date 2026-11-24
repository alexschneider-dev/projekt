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
import { databaseGuard } from "./common.mjs";


const db = new PrismaClient();

try {
  const account = parseAccountArguments(
    process.argv.slice(2),
    Object.values(InternalRole),
    InternalRole.CUSTOMER
  );
  const password = await readAccountPassword();
  const passwordHash = await hashPassword(password);

  databaseGuard();
  const user = await db.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        ...account,
        passwordHash
      }
    });
    if (account.role === InternalRole.SELLER) {
      await tx.seller.create({
        data: {
          userId: createdUser.id,
          name: process.env.MARKETPLACE_SELLER_NAME || "Mein Geschäft",
          slug: createdUser.id
        }
      });
    }

    return createdUser;
  });

  console.log(`Konto angelegt: ${user.email} (${user.role}), Benutzer-ID: ${user.id}`);
} catch (error) {
  reportAccountFailure(error);
} finally {
  await db.$disconnect();
}
