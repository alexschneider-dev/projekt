import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { Registry } from "prom-client";
import { registerSharpMetrics } from "../lib/observability/sharp-metrics.ts";


async function value(registry, name, label, expected) {
  const metric = await registry.getSingleMetric(name).get();

  return metric.values.find(item => item.labels[label] === expected).value;
}

test("Sharp-Messwerte unterscheiden aktuellen Speicher, Höchstwert und Cachelimit", async (t) => {
  let current = 12;
  let queued = 2;

  t.mock.method(sharp, "cache", (...args) => {
    assert.equal(args.length, 0);

    return {
      memory: {
        current,
        high: 512,
        max: 50,
      },
      items: {
        current: 4,
        max: 100,
      },
    };
  });
  t.mock.method(sharp, "counters", (...args) => {
    assert.equal(args.length, 0);

    return {
      queue: queued,
      process: 1,
    };
  });
  const registry = new Registry();

  registry.setDefaultLabels({ service: "nextjs" });
  registerSharpMetrics(registry);
  assert.equal(await value(registry, "app_sharp_memory_bytes", "kind", "current"), 12 * 1024 ** 2);
  assert.equal(await value(registry, "app_sharp_memory_bytes", "kind", "high"), 512 * 1024 ** 2);
  assert.equal(await value(registry, "app_sharp_memory_bytes", "kind", "max"), 50 * 1024 ** 2);
  assert.equal(await value(registry, "app_sharp_tasks", "state", "queue"), 2);
  assert.equal(await value(registry, "app_sharp_tasks", "state", "process"), 1);
  assert.equal(await value(registry, "app_sharp_cache_items", "kind", "current"), 4);
  assert.equal(await value(registry, "app_sharp_cache_items", "kind", "max"), 100);

  current = 0;
  queued = 0;
  assert.equal(await value(registry, "app_sharp_memory_bytes", "kind", "current"), 0);
  assert.equal(await value(registry, "app_sharp_memory_bytes", "kind", "high"), 512 * 1024 ** 2);
  assert.equal(await value(registry, "app_sharp_tasks", "state", "queue"), 0);
  assert.match(await registry.metrics(), /app_sharp_memory_bytes\{kind="current",service="nextjs"\} 0/);
});

test("Echte Bildverarbeitung und Metriken verwenden denselben nativen Sharp-Zustand", async () => {
  const registry = new Registry();
  const before = sharp.cache();
  const concurrency = sharp.concurrency();

  registerSharpMetrics(registry);
  await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 3,
      background: "#ffaacc",
    },
  }).resize(200, 200).webp().toBuffer();
  const stats = sharp.cache();

  assert.equal(await value(registry, "app_sharp_memory_bytes", "kind", "high"), stats.memory.high * 1024 ** 2);
  await registry.metrics();
  assert.equal(sharp.cache().memory.max, before.memory.max);
  assert.equal(sharp.cache().items.max, before.items.max);
  assert.equal(sharp.concurrency(), concurrency);
});
