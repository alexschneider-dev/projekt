import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import Redis from "ioredis";
import { io } from "socket.io-client";
import { publishStatistics } from "./publish.mjs";
import { createWebSocketServer } from "./server.mjs";
import {
  STATISTICS_CHANNEL,
  STATISTICS_EVENT,
  STATISTICS_NAMESPACE
} from "./protocol.mjs";


const origin = "https://localhost";

async function until(check) {
  const deadline = Date.now() + 5000;
  while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(check());
}

test("Redis → öffentliche WebSockets, Wiederverbindung und monotone Zähler", async t => {
  const publisher = new Redis("redis://127.0.0.1:56381");
  const subscriber = new Redis("redis://127.0.0.1:56381");
  t.after(() => publisher.disconnect());
  const reader = new Redis("redis://127.0.0.1:56381");
  await publisher.flushdb();
  const publish = (revision, products, sellers = 3) => publishStatistics(publisher, {
    version: 1,
    available: true,
    products,
    sellers,
    revision
  });
  await publish("1", 1);
  const server = createWebSocketServer({
    subscriber,
    origin,
    reader,
    log: () => {}
  });
  t.after(() => server.close());
  server.httpServer.listen(0, "127.0.0.1");
  await once(server.httpServer, "listening");
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  const values = [
    [],
    []
  ];
  const clients = values.map(events => {
    const client = io(`${url}${STATISTICS_NAMESPACE}`, {
      path: "/marketplace/socket.io",
      transports: ["websocket"],
      extraHeaders: { Origin: origin },
      forceNew: true
    });
    client.on(STATISTICS_EVENT, value => events.push(value));
    t.after(() => client.disconnect());
    return client;
  });
  const latest = () => values.map(events => events.at(-1));
  await until(() => latest().every(value => value?.products === 1));
  assert.equal((await fetch(`${url}/health`)).status, 200);

  await publish("2", 2, 4);
  await until(() => latest().every(value => value?.products === 2 && value?.sellers === 4));
  clients[0].emit(STATISTICS_EVENT, { products: 999 });
  await publisher.publish(STATISTICS_CHANNEL, '{"products":999}');
  assert.equal(await publish("1", 999), 0);

  await publish("3", 0, 0);
  await until(() => latest().every(value => value?.products === 0 && value?.sellers === 0));
  clients[0].disconnect();
  await publish("4", 1);
  clients[0].connect();
  await until(() => latest().every(value => value?.products === 1));

  subscriber.disconnect();
  await until(() => latest().every(value => value?.available === false));
  assert.equal((await fetch(`${url}/health`)).status, 503);
  await publish("5", 0);
  await subscriber.connect();
  await until(() => latest().every(value => value?.products === 0));

  for (const [
    namespace,
    requestOrigin
  ] of [
    [
      STATISTICS_NAMESPACE,
      "https://fremd.invalid"
    ],
    [
      "/",
      origin
    ],
    [
      "/private",
      origin
    ]
  ]) {
    const rejected = io(`${url}${namespace}`, {
      path: "/marketplace/socket.io",
      transports: ["websocket"],
      extraHeaders: { Origin: requestOrigin },
      reconnection: false,
      forceNew: true
    });
    t.after(() => rejected.disconnect());
    await once(rejected, "connect_error");
    assert.equal(rejected.connected, false);
  }
});
