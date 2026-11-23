import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  processImage,
  checkBudget,
  downloadImage
} from "../scripts/images/process.mjs";
import { approvedImages } from "../scripts/images/schema.mjs";


test("Bilder werden in drei begrenzte WebP-Varianten umgewandelt", async () => {
  const input = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: "#176b55",
    },
  })
    .png()
    .toBuffer();
  const result = await processImage(input);
  assert.equal(result.variants.length, 3);
  assert.ok(result.variants.reduce((sum, variant) => sum + variant.buffer.length, 0) <= 200000);
  for (const variant of result.variants) {
    const metadata = await sharp(variant.buffer).metadata();
    assert.equal(metadata.width, variant.width);
    assert.equal(metadata.height, variant.width);
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.exif, undefined);
  }
});

test("Budget und Bildquellen werden vor Zugriffen begrenzt", async () => {
  assert.throws(() => checkBudget(199999999, 2, 200000000));
  assert.throws(() => checkBudget(0, 1, NaN));
  assert.throws(() => checkBudget(0, 1, 3000000000));
  assert.doesNotThrow(() => checkBudget(100, 100, 200));
  await assert.rejects(downloadImage("http://127.0.0.1/private"));
  assert.throws(() => approvedImages([]));
});
