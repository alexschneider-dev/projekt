import { ROUTES } from "@/lib/constants/routes";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./options";
import {
  hasRole,
  type InternalRole
} from "./roles";


export async function requireUser(required: InternalRole = "user") {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(ROUTES.login);
  if (!hasRole(
    session.user.role,
    required
  )) redirect(ROUTES.home);
  return session.user;
}
