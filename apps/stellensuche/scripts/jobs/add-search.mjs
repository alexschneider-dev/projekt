import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { JOB_ERRORS } from "./errors/index.mjs";
import {
  addSearchUrl,
  validateSearchUrl,
} from "./searches.mjs";


const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

async function run() {
  if (process.argv.length !== 4) throw new Error(JOB_ERRORS.searchArgument);
  const url = validateSearchUrl(process.argv[2]);
  if (!process.env.DATABASE_URL) throw new Error(JOB_ERRORS.database);

  const database = new PrismaClient();
  try {
    const inserted = await addSearchUrl(database, url, process.argv[3]);
    console.log(inserted ? "Such-URL gespeichert." : "Such-URL bereits vorhanden; unverändert belassen.");
  } finally {
    await database.$disconnect();
  }
}

run().catch((error) => {
  console.error(Object.values(JOB_ERRORS).includes(error.message) ? error.message : JOB_ERRORS.failed);
  process.exitCode = 1;
});
