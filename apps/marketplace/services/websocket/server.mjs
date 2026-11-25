import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  STATISTICS_CHANNEL,
  STATISTICS_KEY,
  STATISTICS_EVENT,
  STATISTICS_NAMESPACE,
  isStatisticsSnapshot
} from "./protocol.mjs";
import { ERROR_STATISTICS } from "./errors/index.mjs";


export function createWebSocketServer({
  subscriber,
  reader,
  origin,
  path = "/marketplace/socket.io",
  log = console.error
}) {
  let subscribed = false;
  let closed = false;
  let snapshot = unavailable();
  const httpServer = createServer((request, response) => {
    const health = request.url === "/health";
    response.writeHead(health ? (subscribed && reader.status === "ready" ? 200 : 503) : 404);
    response.end(health ? "WebSocket-Server" : "Nicht gefunden");
  });
  const io = new Server(httpServer, {
    path,
    transports: ["websocket"],
    serveClient: false,
    maxHttpBufferSize: 1024,
    allowRequest: (request, callback) => callback(null, request.headers.origin === origin)
  });
  // Nur die Statistik ist öffentlich. Private Namespaces benötigen später eigene Autorisierung.
  const statistics = io.of(STATISTICS_NAMESPACE);
  io.use((_socket, next) => next(new Error(ERROR_STATISTICS.NAMESPACE)));

  function unavailable() {
    return {
      version: 1,
      available: false,
      products: null,
      sellers: null
    };
  }

  function accept(raw) {
    if (closed || !subscribed || typeof raw !== "string" || raw.length > 1024) return;
    try {
      const value = JSON.parse(raw);
      if (!isStatisticsSnapshot(value) || !value.available) return;
      if (snapshot.available && BigInt(value.revision) <= BigInt(snapshot.revision)) return;
      snapshot = value;
      statistics.emit(STATISTICS_EVENT, snapshot);
    } catch { /* Ungültige interne Nachrichten nicht an Browser weitergeben. */ }
  }

  async function loadSnapshot() {
    if (!subscribed || reader.status !== "ready") return;
    try {
      accept(await reader.get(STATISTICS_KEY));
    } catch {
      log(ERROR_STATISTICS.REDIS);
    }
  }

  async function ready() {
    try {
      await subscriber.subscribe(STATISTICS_CHANNEL);
      if (closed || subscriber.status !== "ready") return;
      subscribed = true;
      // Erst abonnieren, dann lesen: Eine gleichzeitige Änderung darf nicht verloren gehen.
      await loadSnapshot();
    } catch { log(ERROR_STATISTICS.REDIS); }
  }

  const invalidate = () => {
    subscribed = false;
    snapshot = unavailable();
    statistics.emit(STATISTICS_EVENT, snapshot);
  };
  const message = (channel, value) => {
    if (channel === STATISTICS_CHANNEL) accept(value);
  };
  const error = () => { log(ERROR_STATISTICS.REDIS); };
  subscriber.on("ready", ready);
  subscriber.on("close", invalidate);
  subscriber.on("error", error);
  subscriber.on("message", message);
  reader.on("ready", loadSnapshot);
  reader.on("error", error);
  statistics.on("connection", socket => { socket.emit(STATISTICS_EVENT, snapshot); });
  if (subscriber.status === "ready") void ready();

  async function close() {
    closed = true;
    subscriber.off("ready", ready);
    subscriber.off("close", invalidate);
    subscriber.off("error", error);
    subscriber.off("message", message);
    reader.off("ready", loadSnapshot);
    reader.off("error", error);
    subscriber.disconnect();
    reader.disconnect();
    await new Promise(resolve => io.close(resolve));
  }

  return {
    httpServer,
    close
  };
}
