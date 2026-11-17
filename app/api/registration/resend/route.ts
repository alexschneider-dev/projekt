import {
  apiHandler,
  successResponse
} from "@/lib/http";
import { checkRegistrationRequest } from "@/lib/auth/check-registration-request";
import { resendVerificationSchema } from "@/lib/schemas/auth/registration.schema";
import { requestRegistration } from "@/lib/auth/registration";
import {
  limitRegistrationRequest,
  limitRegistrationEmail
} from "@/lib/auth/registration-rate-limit";


export const POST = apiHandler(async (request) => {
  await limitRegistrationRequest(request);
  const body = await checkRegistrationRequest(request, resendVerificationSchema);
  if (!body.ok) return body.response;

  await limitRegistrationEmail(body.data.email);
  await requestRegistration(body.data.email);
  const response = successResponse({ accepted: true });
  response.headers.set("Cache-Control", "no-store");
  return response;
});
