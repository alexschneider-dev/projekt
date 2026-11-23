import {
  getServerSession,
  type Session
} from "next-auth";
import { errorResponse } from "../http/error-response";
import {
  createApiError,
  ERROR_AUTH
} from "../http/errors";
import { authOptions } from "./options";
import {
  hasRole,
  CUSTOMER,
  type InternalRole
} from "./roles";


export type ApiGate =
  | {
    ok: true;
    user: NonNullable<Session["user"]>;
  }
  | {
    ok: false;
    response: Response;
  };

export async function requireRole(required: InternalRole = CUSTOMER): Promise<ApiGate> {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user?.id) {
    return {
      ok: false,
      response: errorResponse(createApiError(ERROR_AUTH.UNAUTHORIZED)),
    };
  }
  if (!hasRole(user.role, required)) {
    return {
      ok: false,
      response: errorResponse(createApiError(ERROR_AUTH.FORBIDDEN)),
    };
  }

  return {
    ok: true,
    user,
  };
}
