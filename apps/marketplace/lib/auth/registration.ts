import {
  createHash,
  randomBytes
} from "node:crypto";
import { prisma } from "@/lib/prisma";
import { CUSTOMER } from "./roles";
import { hashPassword } from "./password.mjs";
import { verificationMailer } from "./verification-mail";
import { createApiError } from "@/lib/http/errors";
import { ERROR_REGISTRATION } from "@/lib/http/errors/registration";


const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function requestRegistration(email: string, password?: string) {
  const send = verificationMailer();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const passwordHash = password === undefined ? undefined : await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  if (passwordHash) {
    await prisma.pendingRegistration.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        tokenHash,
        expiresAt,
      },
      update: {
        passwordHash,
        tokenHash,
        expiresAt,
      },
    });
  } else {
    const pending = await prisma.pendingRegistration.updateMany({
      where: {
        email,
        expiresAt: { gt: new Date() },
      },
      data: {
        tokenHash,
        expiresAt,
      },
    });
    if (pending.count === 0) return;
  }

  await send(email, token);
}

export async function confirmRegistration(token: string) {
  const tokenHash = hashToken(token);
  return prisma.$transaction(async (database) => {
    // DELETE ... RETURNING verbraucht den Token atomar, auch bei parallelen Bestätigungen.
    const [pending] = await database.$queryRaw<
      {
        email: string;
        passwordHash: string;
      }[]
    >`
      DELETE FROM "PendingRegistration"
      WHERE "tokenHash" = ${tokenHash} AND "expiresAt" > NOW()
      RETURNING "email", "passwordHash"
    `;
    if (!pending) throw createApiError(ERROR_REGISTRATION.INVALID_TOKEN);

    await database.user.createMany({
      data: [
        {
          email: pending.email,
          passwordHash: pending.passwordHash,
          role: CUSTOMER,
        },
      ],
      skipDuplicates: true,
    });
    return { verified: true };
  });
}
