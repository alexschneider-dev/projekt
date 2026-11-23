export class ApiError<TDetails = unknown> extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: TDetails | undefined;

  constructor(status: number, code: string, message = code, details?: TDetails) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
