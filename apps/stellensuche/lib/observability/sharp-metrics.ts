import sharp from "sharp";
import {
  Gauge,
  type Registry,
} from "prom-client";


// Nur den Zustand dieses Prozesses lesen; Cache und Parallelität unverändert lassen.
export function registerSharpMetrics(registry: Registry) {
  new Gauge({
    name: "app_sharp_memory_bytes",
    help: "Von libvips erfasster Speicher in Bytes; gerundete MiB. high: Höchstwert seit Prozessstart, max: Cachelimit, kein RSS-Limit",
    labelNames: ["kind"] as const,
    registers: [registry],
    collect() {
      const { memory } = sharp.cache();

      for (const kind of [
        "current",
        "high",
        "max",
      ] as const) {
        this.set({ kind }, memory[kind] * 1024 * 1024);
      }
    },
  });
  new Gauge({
    name: "app_sharp_tasks",
    help: "Wartende und aktive Sharp-Aufgaben zum Zeitpunkt der Metrikabfrage",
    labelNames: ["state"] as const,
    registers: [registry],
    collect() {
      const tasks = sharp.counters();

      this.set({ state: "queue" }, tasks.queue);
      this.set({ state: "process" }, tasks.process);
    },
  });
  new Gauge({
    name: "app_sharp_cache_items",
    help: "Aktuelle Anzahl gecachter libvips-Operationen und eingestelltes Cachelimit",
    labelNames: ["kind"] as const,
    registers: [registry],
    collect() {
      const { items } = sharp.cache();

      this.set({ kind: "current" }, items.current);
      this.set({ kind: "max" }, items.max);
    },
  });
}
