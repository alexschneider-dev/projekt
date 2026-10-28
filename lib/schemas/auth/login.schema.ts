import { z } from "zod";

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .min(1, "Bitte gib deine E-Mail-Adresse ein.")
    .email("Bitte gib eine gültige E-Mail-Adresse ein.")
    .max(254, "Die E-Mail-Adresse darf höchstens 254 Zeichen enthalten."),
  // Login validates existing credentials; password creation has its own policy.
  password: z.string()
    .min(1, "Bitte gib dein Passwort ein.")
    .max(128, "Das Passwort darf höchstens 128 Zeichen enthalten."),
});

export type LoginFormInput = z.input<typeof loginSchema>;
export type LoginFormValues = z.output<typeof loginSchema>;
