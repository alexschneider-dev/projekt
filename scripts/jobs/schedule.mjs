import { setTimeout as sleep } from "node:timers/promises";


export async function waitForNextImport(database, started, wait = sleep, now = Date.now) {
  const nextRun = Math.max(started + 3_600_000, now() + 60_000);
  while (now() < nextRun) {
    const state = await database.jobImportState.findUniqueOrThrow({ where: { id: 1 } });
    if (state.requested) return;

    await wait(Math.min(5000, nextRun - now()));
  }
}
