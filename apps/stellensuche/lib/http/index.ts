import { HTTP_STATUS } from "./status";
import { errorResponse } from "./error-response";


export function apiHandler<TContext = unknown>(handler: (req: Request, context: TContext) => Promise<Response>) {
  return async (req: Request, context: TContext): Promise<Response> => {
    try {
      return await handler(req, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function successResponse<T>(data?: T, status: number = HTTP_STATUS.OK): Response {
  if (status === HTTP_STATUS.NO_CONTENT || status === HTTP_STATUS.RESET_CONTENT) return new Response(null, { status });

  return Response.json(data === undefined ? { success: true } : data, { status });
}
