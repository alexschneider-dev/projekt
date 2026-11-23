import { redirect } from "next/navigation";
import { ROUTES } from "../constants/routes";
import { HTTP_STATUS } from "../http/status";


export function redirectAfterAccessDenied(response: Response): never {
  const destination = response.status === HTTP_STATUS.UNAUTHORIZED ? ROUTES.login : ROUTES.home;

  redirect(destination);
}
