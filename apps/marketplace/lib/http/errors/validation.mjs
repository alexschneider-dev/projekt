export const ERROR_VALIDATION = {
  EMAIL_REQUIRED: {
    status: 400,
    code: "EMAIL_REQUIRED",
    message: "Bitte gib deine E-Mail-Adresse ein.",
  },
  EMAIL_INVALID: {
    status: 400,
    code: "EMAIL_INVALID",
    message: "Bitte gib eine gültige E-Mail-Adresse ein.",
  },
  EMAIL_TOO_LONG: {
    status: 400,
    code: "EMAIL_TOO_LONG",
    message: "Die E-Mail-Adresse darf höchstens 254 Zeichen enthalten.",
  },
  PASSWORD_REQUIRED: {
    status: 400,
    code: "PASSWORD_REQUIRED",
    message: "Bitte gib dein Passwort ein.",
  },
  PASSWORD_TOO_LONG: {
    status: 400,
    code: "PASSWORD_TOO_LONG",
    message: "Das Passwort darf höchstens 128 Zeichen enthalten.",
  },
};
