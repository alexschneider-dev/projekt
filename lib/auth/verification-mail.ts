import { createHash } from "node:crypto";
import { ROUTES } from "@/lib/constants/routes";
import { createApiError } from "@/lib/http/errors";
import { ERROR_REGISTRATION } from "@/lib/http/errors/registration";


export function verificationMailer() {
  let origin: URL;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  try {
    origin = new URL(process.env.NEXTAUTH_URL ?? "");
    const local = [
      "localhost",
      "127.0.0.1"
    ].includes(origin.hostname);
    if (!apiKey || !from || (origin.protocol !== "https:" && !(local && origin.protocol === "http:"))) {
      throw createApiError(ERROR_REGISTRATION.MAIL_UNAVAILABLE);
    }
  } catch {
    throw createApiError(ERROR_REGISTRATION.MAIL_UNAVAILABLE);
  }

  return async (email: string, token: string) => {
    const link = new URL(ROUTES.verifyEmail, origin);
    // Fragment statt Query: Der Token landet nicht in HTTP-Zugriffslogs oder Referrern.
    link.hash = token;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": createHash("sha256").update(token).digest("hex"),
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "E-Mail-Adresse bestätigen",
          text: `Bestätige deine E-Mail-Adresse, um dein Konto anzulegen:\n\n${link.href}\n\nDer Link gilt 24 Stunden und ist nur einmal verwendbar. Wenn du dich nicht registriert hast, ignoriere diese E-Mail.`,
        }),
      });
      await response.body?.cancel();
      if (!response.ok) throw createApiError(ERROR_REGISTRATION.MAIL_UNAVAILABLE);
    } catch {
      // Keine API-Schlüssel, Token oder Anbieterantworten in Fehlerprotokolle übernehmen.
      throw createApiError(ERROR_REGISTRATION.MAIL_UNAVAILABLE);
    }
  };
}
