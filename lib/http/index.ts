import { errorResponse } from "./error-response";


export function apiHandler<TContext = unknown>(
  handler: (
    req: Request,
    context: TContext
  ) => Promise<Response>,
) {
  return async (
    req: Request,
    context: TContext
  ): Promise<Response> => {
    try {
      return await handler(
        req,
        context
      );
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function successResponse<T>(
  data?: T,
  status = 200
): Response {
  if (status === 204 || status === 205) return new Response(
    null,
    { status }
  );
  return Response.json(
    data === undefined ? { success: true } : data,
    { status }
  );
}
