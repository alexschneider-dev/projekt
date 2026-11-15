import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { JOB_ERRORS } from "./errors/index.mjs";
import { importJobs } from "./import.mjs";


const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

async function run() {
  if (!process.env.DATABASE_URL) throw new Error(JOB_ERRORS.database);

  do {
    const started = Date.now();
    const database = new PrismaClient();
    const lockClient = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 15_000,
      query_timeout: 60_000,
    });
    // Bei Verlust der Sperrverbindung sofort beenden; kein ungesperrter Import.
    lockClient.on("error", () => {
      console.error(JOB_ERRORS.failed);
      process.exit(1);
    });
    try {
      await lockClient.connect();
      const result = await importJobs(database, lockClient);
      console.log(result.skipped
        ? "Stellenimport übersprungen: Ein Durchlauf läuft bereits."
        : `Stellenimport abgeschlossen: ${result.inserted} neue Links.`);
    } catch (error) {
      const message = Object.values(JOB_ERRORS).includes(error.message) ? error.message : JOB_ERRORS.failed;
      console.error(message);
      if (process.argv.includes("--once")) process.exitCode = 1;
    } finally {
      try {
        await database.$disconnect();
      } finally {
        await lockClient.end();
      }
    }

    if (process.argv.includes("--once")) break;
    await sleep(Math.max(60_000, 3_600_000 - (Date.now() - started)));
  } while (true);
}

run().catch((error) => {
  console.error(Object.values(JOB_ERRORS).includes(error.message) ? error.message : JOB_ERRORS.failed);
  process.exitCode = 1;
});
