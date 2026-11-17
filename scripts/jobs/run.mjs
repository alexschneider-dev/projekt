import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { JOB_ERRORS } from "./errors/index.mjs";
import { jobErrorLog } from "./errors/log.mjs";
import { importJobs } from "./import.mjs";
import {
  IMPORT_INTERVAL_MS,
  loadImportUsers,
} from "./schedule.mjs";


const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

async function run() {
  if (!process.env.DATABASE_URL) throw new Error(JOB_ERRORS.database);

  const database = new PrismaClient();
  try {
    do {
      const users = await loadImportUsers(database);
      let blocked = false;
      for (const user of users) {
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
          const result = await importJobs(database, lockClient, undefined, user.id, user.scheduledAt);
          console.log(result.skipped
            ? "Stellenimport übersprungen: Ein Durchlauf läuft bereits."
            : result.stopped
              ? `Stellenimport gestoppt: ${result.inserted} neue Links.`
              : `Stellenimport abgeschlossen: ${result.inserted} neue Links.`);
        } catch (error) {
          console.error(jobErrorLog(error, {
            phase,
            userId: user.id,
          }));
          if (process.argv.includes("--once")) process.exitCode = 1;
          if (error.httpStatus === 403 || error.httpStatus === 429) {
            blocked = true;
            break;
          }
        } finally {
          await lockClient.end();
        }
      }

      if (process.argv.includes("--once")) break;
      if (blocked) {
        // Eine Sperre gilt für den Dienst, nicht nur für den aktuellen Benutzer.
        await sleep(IMPORT_INTERVAL_MS);
      } else {
        // Keine schnelle Schleife bei belegter Sperre oder lang laufenden Importen.
        await sleep(5000);
      }
    } while (true);
  } finally {
    await database.$disconnect();
  }
}

run().catch((error) => {
  console.error(jobErrorLog(error, { phase: "Importdienst" }));
  process.exitCode = 1;
});
