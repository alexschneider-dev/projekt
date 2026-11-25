import Redis from "ioredis";
import { createWebSocketServer } from "./server.mjs";
import { ERROR_STATISTICS } from "./errors/index.mjs";


if (!process.env.REDIS_URL || !process.env.WEBSOCKET_ORIGIN) {
  console.error(ERROR_STATISTICS.CONFIG);
  process.exit(1);
}

const subscriber = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  connectTimeout: 3000,
  maxRetriesPerRequest: 1
});
const reader = subscriber.duplicate();
const server = createWebSocketServer({
  subscriber,
  reader,
  origin: process.env.WEBSOCKET_ORIGIN,
  path: `${process.env.BASE_PATH ?? "/marketplace"}/socket.io`
});
server.httpServer.on("error", () => {
  console.error(ERROR_STATISTICS.START);
  void shutdown(1);
});
server.httpServer.listen(Number(process.env.PORT ?? 3010), "0.0.0.0");
void reader.connect().catch(() => { console.error(ERROR_STATISTICS.REDIS); });
void subscriber.connect().catch(() => { console.error(ERROR_STATISTICS.REDIS); });

let stopping = false;
async function shutdown(code) {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  await server.close();
  clearTimeout(deadline);
  process.exit(code);
}
process.on("SIGTERM", () => { void shutdown(0); });
process.on("SIGINT", () => { void shutdown(0); });
