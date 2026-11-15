import { createRequire } from "node:module";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { JOB_ERRORS } from "./errors/index.mjs";
import { importJobs } from "./import.mjs";
import { waitForNextImport } from "./schedule.mjs";


const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

async function run() {
  if (!process.env.DATABASE_URL) throw new Error(JOB_ERRORS.database);

  const database = new PrismaClient();
  try {
    do {
      const started = Date.now();
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
        await lockClient.end();
      }

      if (process.argv.includes("--once")) break;
      await waitForNextImport(database, started);
    } while (true);
  } finally {
    await database.$disconnect();
  }
}

run().catch((error) => {
  console.error(Object.values(JOB_ERRORS).includes(error.message) ? error.message : JOB_ERRORS.failed);
  process.exitCode = 1;
});
