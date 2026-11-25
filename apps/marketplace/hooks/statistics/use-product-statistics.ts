"use client";

import { useSyncExternalStore } from "react";
import {
  subscribeStatistics,
  getStatisticsSnapshot,
  getServerStatisticsSnapshot
} from "@/lib/statistics/socket";


export function useProductStatistics() {
  return useSyncExternalStore(subscribeStatistics, getStatisticsSnapshot, getServerStatisticsSnapshot);
}
