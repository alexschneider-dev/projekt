import sharp from "sharp";
import { createHash } from "node:crypto";
import { ERRORS } from "../errors/index.mjs";


export const sizes = [
  {
    width: 160,
    budget: 15000,
  },
  {
    width: 480,
    budget: 45000,
  },
  {
    width: 960,
    budget: 140000,
  },
];

export async function processImage(buffer) {
  if (buffer.length > 10000000) throw new Error(ERRORS.SIZE);
  const variants = [];
  for (const size of sizes) {
    let output;
    for (const quality of [
      80,
      65,
      50,
      35
    ]) {
      output = await sharp(buffer, { limitInputPixels: 25000000 })
        .rotate()
        .resize(size.width, size.width, {
          fit: "contain",
          background: "#f1f3f4",
        })
        .webp({ quality })
        .toBuffer();
      if (output.length <= size.budget) break;
    }
    if (output.length > size.budget) throw new Error(ERRORS.PROCESS);
    variants.push({
      width: size.width,
      buffer: output,
    });
  }
  return {
    hash: createHash("sha256").update(buffer).digest("hex"),
    variants,
  };
}

export async function downloadImage(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "images.pexels.com") throw new Error(ERRORS.SOURCE);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(ERRORS.SOURCE);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 10000000) throw new Error(ERRORS.SIZE);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function checkBudget(used, additional, budget) {
  if (!Number.isSafeInteger(budget) || budget <= 0 || budget > 2000000000 || used + additional > budget)
    throw new Error(ERRORS.BUDGET);
}
