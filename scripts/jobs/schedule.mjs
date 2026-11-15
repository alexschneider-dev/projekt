import { setTimeout as sleep } from "node:timers/promises";


export async function waitForNextImport(database, started, wait = sleep, now = Date.now) {
  const nextRun = started + 3_600_000;
  while (now() < nextRun) {
    const state = await database.jobImportState.findFirst({
      where: {
        requested: true,
        user: { active: true },
      },
    });
    if (state) return;

    await wait(Math.min(5000, nextRun - now()));
  }
}

export async function loadImportUsers(database, scheduled) {
  return database.user.findMany({
    where: {
      active: true,
      ...(scheduled ? {} : { importState: { is: { requested: true } } }),
    },
    orderBy: { id: "asc" },
    select: { id: true },
  });
}
