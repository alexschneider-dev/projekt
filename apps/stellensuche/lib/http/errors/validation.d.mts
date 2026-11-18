export const ERROR_VALIDATION: {
  readonly EMAIL_REQUIRED: {
    readonly status: 400;
    readonly code: "EMAIL_REQUIRED";
    readonly message: string;
  };
  readonly EMAIL_INVALID: {
    readonly status: 400;
    readonly code: "EMAIL_INVALID";
    readonly message: string;
  };
  readonly EMAIL_TOO_LONG: {
    readonly status: 400;
    readonly code: "EMAIL_TOO_LONG";
    readonly message: string;
  };
  readonly PASSWORD_REQUIRED: {
    readonly status: 400;
    readonly code: "PASSWORD_REQUIRED";
    readonly message: string;
  };
  readonly PASSWORD_TOO_LONG: {
    readonly status: 400;
    readonly code: "PASSWORD_TOO_LONG";
    readonly message: string;
  };
};
