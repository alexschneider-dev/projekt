import { ERROR_VALIDATION } from "../../http/errors/validation.mjs";
import { z } from "zod";


export const loginSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .min(1, ERROR_VALIDATION.EMAIL_REQUIRED.message)
    .email(ERROR_VALIDATION.EMAIL_INVALID.message)
    .max(254, ERROR_VALIDATION.EMAIL_TOO_LONG.message),
  password: z.string()
    .min(1, ERROR_VALIDATION.PASSWORD_REQUIRED.message)
    .max(128, ERROR_VALIDATION.PASSWORD_TOO_LONG.message),
});

export type LoginFormInput = z.input<typeof loginSchema>;
export type LoginFormValues = z.output<typeof loginSchema>;
