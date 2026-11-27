export type ApiErrorOptions<TDetails = unknown> = {
  /** Bewusst öffentliche Angaben für den Client. */
  publicDetails?: TDetails;
  /** Interne Diagnose; wird niemals in die HTTP-Antwort übernommen. */
  cause?: unknown;
};

export class ApiError<TDetails = unknown> extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: TDetails | undefined;

  constructor(status: number, code: string, message = code, options: ApiErrorOptions<TDetails> = {}) {
    super(message, { cause: options.cause });

    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = options.publicDetails;
  }
}
