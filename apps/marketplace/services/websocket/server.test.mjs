import assert from "node:assert/strict";
import { test } from "node:test";
import { isStatisticsSnapshot } from "./protocol.mjs";


test("Statistikprotokoll akzeptiert Nullbestand und verwirft ungültige Nutzdaten", () => {
  assert.ok(isStatisticsSnapshot({
    version: 1,
    available: true,
    products: 0,
    sellers: 0,
    revision: "1"
  }));
  assert.ok(isStatisticsSnapshot({
    version: 1,
    available: false,
    products: null,
    sellers: null
  }));
  for (const products of [
    -1,
    0.5,
    "2",
    Number.MAX_SAFE_INTEGER + 1,
    null
  ]) {
    assert.equal(isStatisticsSnapshot({
      version: 1,
      available: true,
      products,
      sellers: 0,
      revision: "1"
    }), false);
  }
});
