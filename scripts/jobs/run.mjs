import { createRequire } from "node:module";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { JOB_ERRORS } from "./errors/index.mjs";
import { jobErrorLog } from "./errors/log.mjs";
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
      lockClient.on("error", (error) => {
        console.error(jobErrorLog(error, { phase: "Sperrverbindung verloren" }));
        process.exit(1);
      });
      let phase = "Sperrverbindung aufbauen";
      try {
        await lockClient.connect();
        phase = "Import ausführen";
        const result = await importJobs(database, lockClient);
        console.log(result.skipped
          ? "Stellenimport übersprungen: Ein Durchlauf läuft bereits."
          : `Stellenimport abgeschlossen: ${result.inserted} neue Links.`);
      } catch (error) {
        console.error(jobErrorLog(error, { phase }));
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
  console.error(jobErrorLog(error, { phase: "Importdienst" }));
  process.exitCode = 1;
});
