import { z } from "zod";
import { loginSchema } from "./login.schema";
import { ERROR_PASSWORD } from "@/lib/http/errors/password.mjs";
import { ERROR_REGISTRATION } from "@/lib/http/errors/registration";


export const registrationSchema = loginSchema.extend({
  password: z.string().min(12, ERROR_PASSWORD.INVALID_PASSWORD_LENGTH.message)
    .max(128, ERROR_PASSWORD.INVALID_PASSWORD_LENGTH.message),
});
export const resendVerificationSchema = registrationSchema.pick({ email: true });
export const verifyEmailSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, ERROR_REGISTRATION.INVALID_TOKEN.message),
});
export type RegistrationValues = z.infer<typeof registrationSchema>;
