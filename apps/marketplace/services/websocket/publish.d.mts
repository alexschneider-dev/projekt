import type Redis from "ioredis";
import type { StatisticsSnapshot } from "./protocol.mjs";


export function publishStatistics(
  redis: Redis,
  snapshot: Extract<StatisticsSnapshot, { available: true }>
): Promise<unknown>;
