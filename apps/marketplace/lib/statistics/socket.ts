"use client";

import {
  io,
  type Socket
} from "socket.io-client";
import { withBasePath } from "@/lib/constants/base-path";
import { ROUTES } from "@/lib/constants/routes";
import {
  STATISTICS_NAMESPACE,
  STATISTICS_EVENT,
  isStatisticsSnapshot,
  type StatisticsSnapshot
} from "@/services/websocket/protocol.mjs";


let socket: Socket | null = null;
let snapshot: StatisticsSnapshot | null = null;
const consumers = new Set<() => void>();

function receive(value: unknown) {
  if (!isStatisticsSnapshot(value)) return;
  snapshot = value;
  consumers.forEach(notify => notify());
}

function unavailable() {
  snapshot = null;
  consumers.forEach(notify => notify());
}

function reconnect() {
  socket?.connect();
}

function disconnected(reason: string) {
  unavailable();
  if (reason === "io server disconnect") reconnect();
}

export function subscribeStatistics(notify: () => void) {
  consumers.add(notify);
  if (!socket) {
    socket = io(STATISTICS_NAMESPACE, {
      path: withBasePath(ROUTES.statisticsSocket),
      autoConnect: false,
      transports: ["websocket"]
    });
    socket.on(STATISTICS_EVENT, receive);
    socket.on("disconnect", disconnected);
    socket.on("connect_error", unavailable);
    window.addEventListener("online", reconnect);
    socket.connect();
  }

  return () => {
    consumers.delete(notify);
    if (consumers.size === 0) {
      window.removeEventListener("online", reconnect);
      socket?.off(STATISTICS_EVENT, receive);
      socket?.off("disconnect", disconnected);
      socket?.off("connect_error", unavailable);
      socket?.disconnect();
      socket = null;
      snapshot = null;
    }
  };
}

export const getStatisticsSnapshot = () => snapshot;
export const getServerStatisticsSnapshot = () => null;
