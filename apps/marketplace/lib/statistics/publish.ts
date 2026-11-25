import Redis from "ioredis";
import {
  STATISTICS_KEY,
  isStatisticsSnapshot
} from "@/services/websocket/protocol.mjs";
import { publishStatistics } from "@/services/websocket/publish.mjs";
import type { readCatalogStatistics } from "./snapshot";
import { ERROR_STATISTICS } from "@/lib/http/errors/statistics";


let publisher: Redis | undefined;
let connecting: Promise<void> | undefined;

async function getPublisher(url: string) {
  if (!publisher) {
    publisher = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
      commandTimeout: 1500
    });
    publisher.on("error", () => { console.error(ERROR_STATISTICS.PUBLISH); });
  }
  if (publisher.status === "wait" || publisher.status === "end") {
    connecting = publisher.connect().finally(() => { connecting = undefined; });
  }
  if (connecting) await connecting;

  return publisher;
}

// Ein unbekannter Redis-Zustand darf keinen unnötigen Datenbankabruf auslösen.
export async function hasCatalogStatistics() {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const redis = await getPublisher(url);
    const raw = await redis.get(STATISTICS_KEY);
    if (!raw) return false;

    try {
      const snapshot: unknown = JSON.parse(raw);
      return isStatisticsSnapshot(snapshot) && snapshot.available;
    } catch {
      return false;
    }
  } catch {
    console.error(ERROR_STATISTICS.INITIALIZE);
    return null;
  }
}

// Erst nach dem Datenbank-Commit aufrufen. Redis-Ausfälle ändern kein erfolgreiches Schreibergebnis.
export async function publishCatalogChanged(snapshot: Awaited<ReturnType<typeof readCatalogStatistics>>) {
  const url = process.env.REDIS_URL;
  if (!url) return false;

  try {
    const redis = await getPublisher(url);
    await publishStatistics(redis, snapshot);
    return true;
  } catch {
    console.error(ERROR_STATISTICS.PUBLISH);
    return false;
  }
}
