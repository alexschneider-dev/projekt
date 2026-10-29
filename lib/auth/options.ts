import { ROUTES } from "@/lib/constants/routes";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createHash } from "node:crypto";
import { loginSchema } from "@/lib/schemas/auth/login.schema";
import { prisma } from "@/lib/prisma";
import {
  dummyHash,
  verifyPassword
} from "./password.mjs";


export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60
  },
  pages: {
    signIn: ROUTES.login,
    error: ROUTES.login
  },
  providers: [CredentialsProvider({
    name: "E-Mail und Passwort",
    credentials: {
      email: {
        label: "E-Mail",
        type: "email"
      },
      password: {
        label: "Passwort",
        type: "password"
      },
    },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);

      if (!parsed.success) return null;

      const {
        email,
        password
      } = parsed.data;

      const key = createHash("sha256").update(email).digest("hex");

      // Gemeinsames, atomares Limit über alle App-Instanzen: zehn Versuche pro Konto in 15 Minuten.
      const [limit] = await prisma.$queryRaw<{ attempts: number }[]>`
        INSERT INTO "LoginAttempt" ("key", "attempts", "expiresAt")
        VALUES (${key}, 1, NOW() + INTERVAL '15 minutes')
        ON CONFLICT ("key") DO UPDATE SET
          "attempts" = CASE WHEN "LoginAttempt"."expiresAt" <= NOW()
            THEN 1 ELSE LEAST("LoginAttempt"."attempts" + 1, 11) END,
          "expiresAt" = CASE WHEN "LoginAttempt"."expiresAt" <= NOW()
            THEN NOW() + INTERVAL '15 minutes' ELSE "LoginAttempt"."expiresAt" END
        RETURNING "attempts"
      `;

      if (!limit || limit.attempts > 10) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash);

      if (!valid || !user || !user.active) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        sessionVersion: user.sessionVersion
      };
    },
  })],
  callbacks: {
    async jwt({
      token,
      user
    }) {
      if (user) {
        token.sub = user.id;
        token.sessionVersion = user.sessionVersion;
      }

      return token;
    },
    async session({
      session,
      token
    }) {
      session.user = undefined;

      if (!token.sub) return session;

      const user = await prisma.user.findUnique({ where: { id: token.sub } });

      if (user?.active && user.sessionVersion === token.sessionVersion) {
        session.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }

      return session;
    },
  },
};
