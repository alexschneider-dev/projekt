import {
  apiHandler,
  successResponse
} from "@/lib/http";
import { checkRegistrationRequest } from "@/lib/auth/check-registration-request";
import { verifyEmailSchema } from "@/lib/schemas/auth/registration.schema";
import { confirmRegistration } from "@/lib/auth/registration";
import { limitRegistrationRequest } from "@/lib/auth/registration-rate-limit";


export const POST = apiHandler(async (request) => {
  await limitRegistrationRequest(request, true);
  const body = await checkRegistrationRequest(request, verifyEmailSchema);
  if (!body.ok) return body.response;

  await confirmRegistration(body.data.token);
  const response = successResponse({ verified: true });
  response.headers.set("Cache-Control", "no-store");
  return response;
});
