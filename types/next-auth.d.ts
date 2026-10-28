import type { DefaultSession } from "next-auth";
import type { InternalRole } from "@/lib/auth/roles";

declare module "next-auth" {
  interface Session {
    user?: (NonNullable<DefaultSession["user"]> & { id: string; role: InternalRole }) | undefined;
  }
  interface User { role: InternalRole; sessionVersion: number; }
}
declare module "next-auth/jwt" {
  interface JWT { sessionVersion?: number; }
}
