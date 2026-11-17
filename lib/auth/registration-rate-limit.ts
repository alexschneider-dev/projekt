import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";
import { createApiError } from "@/lib/http/errors";
import { ERROR_REGISTRATION } from "@/lib/http/errors/registration";


async function consume(key: string, maximum: number) {
  const hashedKey = createHash("sha256").update(`registration:${key}`).digest("hex");
  const [limit] = await prisma.$queryRaw<{ attempts: number }[]>`
    INSERT INTO "LoginAttempt" ("key", "attempts", "expiresAt")
    VALUES (${hashedKey}, 1, NOW() + INTERVAL '1 hour')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "LoginAttempt"."expiresAt" <= NOW()
        THEN 1 ELSE LEAST("LoginAttempt"."attempts" + 1, ${maximum + 1}) END,
      "expiresAt" = CASE WHEN "LoginAttempt"."expiresAt" <= NOW()
        THEN NOW() + INTERVAL '1 hour' ELSE "LoginAttempt"."expiresAt" END
    RETURNING "attempts"
  `;
  if (!limit || limit.attempts > maximum) throw createApiError(ERROR_REGISTRATION.RATE_LIMIT);
}

export async function limitRegistrationRequest(request: Request, verification = false) {
  // Nur hinter dem eigenen Proxy aktivieren: Nginx überschreibt X-Real-IP.
  const header = process.env.TRUST_PROXY === "true" ? request.headers.get("x-real-ip") : null;
  const address = header && isIP(header) ? header : "shared";
  const scope = verification ? "verify" : "mail";
  await consume(`${scope}:source:${address}`, verification ? 30 : 10);
  await consume(`${scope}:global`, verification ? 500 : 100);
}

export async function limitRegistrationEmail(email: string) {
  await consume(`mail:email:${email}`, 3);
  await prisma.loginAttempt.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.pendingRegistration.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
