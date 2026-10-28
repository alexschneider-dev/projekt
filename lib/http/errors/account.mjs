export const ERROR_ACCOUNT = {
  INVALID_ROLE: {
    status: 400,
    code: "INVALID_ROLE",
    message: "Rolle muss user, admin oder super_admin sein.",
  },
  INTERACTIVE_TERMINAL_REQUIRED: {
    status: 400,
    code: "INTERACTIVE_TERMINAL_REQUIRED",
    message: "Bitte in einem interaktiven Terminal ausführen.",
  },
  PASSWORD_MISMATCH: {
    status: 400,
    code: "PASSWORD_MISMATCH",
    message: "Passwörter stimmen nicht überein.",
  },
  EMAIL_ALREADY_EXISTS: {
    status: 409,
    code: "EMAIL_ALREADY_EXISTS",
    message: "Für diese E-Mail existiert bereits ein Konto.",
  },
  ACCOUNT_CREATION_FAILED: {
    status: 500,
    code: "ACCOUNT_CREATION_FAILED",
    message: "Konto konnte nicht angelegt werden. Datenbank und Eingaben prüfen.",
  },
};
