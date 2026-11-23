import pg from "pg";
import {
  readFile,
  mkdir,
  rm
} from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import {
  databaseGuard,
  reportFailure
} from "../common.mjs";
import { ERRORS } from "../errors/index.mjs";
import { approvedImages } from "./schema.mjs";
import {
  processImage,
  downloadImage,
  checkBudget
} from "./process.mjs";


const db = new PrismaClient();
let locked = false;
let lockClient;
try {
  databaseGuard();
  lockClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await lockClient.connect();
  const lock = await lockClient.query("SELECT pg_try_advisory_lock(71422951) AS acquired");
  if (!lock.rows[0].acquired) throw new Error(ERRORS.LOCK);
  const names = [
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_URL",
    "R2_IMAGE_BUDGET_BYTES",
  ];
  if (names.some((name) => !process.env[name])) throw new Error(ERRORS.CONFIG);
  const endpoint = new URL(process.env.R2_ENDPOINT);
  const publicUrl = new URL(process.env.R2_PUBLIC_URL);
  if (
    endpoint.protocol !== "https:" ||
    !endpoint.hostname.endsWith(".r2.cloudflarestorage.com") ||
    publicUrl.protocol !== "https:"
  )
    throw new Error(ERRORS.CONFIG);
  const rows = approvedImages(JSON.parse(await readFile(process.argv[2] ?? "data/approved.json", "utf8")));
  const budget = Number(process.env.R2_IMAGE_BUDGET_BYTES);
  checkBudget(0, 0, budget);
  await mkdir("data", { recursive: true });
  await mkdir("data/import.lock").catch(() => {
    throw new Error(ERRORS.LOCK);
  });
  locked = true;
  const client = new S3Client({
    region: "auto",
    endpoint: endpoint.href,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  const bucket = process.env.R2_BUCKET;
  const objects = new Map();
  let continuation;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuation,
      }),
    );
    for (const object of page.Contents ?? []) objects.set(object.Key, object.Size ?? 0);
    continuation = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuation);
  let used = [...objects.values()].reduce((sum, size) => sum + size, 0);
  for (const row of rows) {
    const id = `pexels-${row.id}`;
    if (await db.imageAsset.findUnique({ where: { id } })) continue;
    const {
      hash,
      variants
    } = await processImage(await downloadImage(row.downloadUrl));
    if (await db.imageAsset.findUnique({ where: { contentHash: hash } })) continue;
    const keys = variants.map((variant) => `marketplace-images/v1/${hash}/${variant.width}.webp`);
    const additional = variants.reduce(
      (sum, variant, index) => sum + (objects.has(keys[index]) ? 0 : variant.buffer.length),
      0,
    );
    checkBudget(used, additional, budget);
    for (let index = 0;index < variants.length;index++) {
      if (objects.has(keys[index])) continue;
      const variant = variants[index];
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: keys[index],
          Body: variant.buffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      objects.set(keys[index], variant.buffer.length);
      used += variant.buffer.length;
    }
    const urls = keys.map((key) => `${publicUrl.href.replace(/\/$/, "")}/${key}`);
    await db.imageAsset.create({
      data: {
        id,
        sourceUrl: row.sourceUrl,
        photographer: row.photographer,
        photographerUrl: row.photographerUrl,
        alt: row.alt,
        material: row.material,
        color: row.color,
        kind: row.kind,
        smallUrl: urls[0],
        mediumUrl: urls[1],
        largeUrl: urls[2],
        bytes: variants.reduce((sum, variant) => sum + variant.buffer.length, 0),
        contentHash: hash,
      },
    });
    console.log(
      JSON.stringify({
        ereignis: "bild_importiert",
        id,
        belegteBytes: used,
        budget,
      }),
    );
  }
} catch (error) {
  reportFailure(error);
} finally {
  if (locked) await rm("data/import.lock", { recursive: true });
  await lockClient?.end();
  await db.$disconnect();
}
