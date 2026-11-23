import {
  PrismaClient,
  InternalRole
} from "@prisma/client";
import { hashPassword } from "../lib/auth/password.mjs";
import {
  databaseGuard,
  reportFailure
} from "./common.mjs";
import { ERRORS } from "./errors/index.mjs";


const db = new PrismaClient();
try {
  databaseGuard();
  const email = process.env.MARKETPLACE_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.MARKETPLACE_USER_PASSWORD;
  const role = process.env.MARKETPLACE_USER_ROLE ?? InternalRole.CUSTOMER;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || !Object.values(InternalRole).includes(role))
    throw new Error(ERRORS.CONFIG);
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        role,
      },
    });
    if (role === InternalRole.SELLER)
      await tx.seller.create({
        data: {
          userId: user.id,
          name: process.env.MARKETPLACE_SELLER_NAME || "Mein Geschäft",
          slug: user.id,
        },
      });
  });
  console.log("Konto wurde angelegt.");
} catch (error) {
  reportFailure(error);
} finally {
  await db.$disconnect();
}
