import { z } from "zod";
import { checkApiRequest } from "@/lib/http/check-api-request";
import {
  createApiError,
  ERROR_API
} from "@/lib/http/errors";


export async function checkRegistrationRequest<T extends z.ZodType>(request: Request, schema: T) {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const {
          done,
          value
        } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) {
          await reader.cancel();
          throw createApiError(ERROR_API.INVALID_BODY);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  return checkApiRequest(
    new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    }),
    schema,
  );
}
