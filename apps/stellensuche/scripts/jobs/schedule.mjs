import { JOB_ERRORS } from "./errors/index.mjs";


export const IMPORT_TIME_ZONE = "Europe/Berlin";
export const IMPORT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const formatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: IMPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function localTime(date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [
    part.type,
    part.value,
  ]));
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function nextScheduledRun(time, after = new Date(), followingDay = false) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(JOB_ERRORS.schedule);

  const local = localTime(after);
  const skipToday = followingDay || local.time >= time;
  // UTC-Minuten durchlaufen: fehlende Sommerzeit-Uhrzeiten starten zur nächsten gültigen Minute.
  for (let timestamp = Math.floor(after.getTime() / 60_000) * 60_000 + 60_000;
    timestamp <= after.getTime() + 49 * 60 * 60_000; timestamp += 60_000) {
    const candidate = new Date(timestamp);
    const next = localTime(candidate);
    if ((!skipToday || next.day > local.day) && next.time >= time) return candidate;
  }
  throw new Error(JOB_ERRORS.schedule);
}

export async function loadImportUsers(database, now = new Date()) {
  const users = await database.user.findMany({
    where: {
      active: true,
      importState: {
        is: {
          OR: [
            { requested: true },
            {
              scheduleTime: { not: null },
              nextScheduledAt: { lte: now },
            },
          ],
        },
      },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      importState: { select: { nextScheduledAt: true } },
    },
  });
  return users.map(user => ({
    id: user.id,
    scheduledAt: user.importState.nextScheduledAt && user.importState.nextScheduledAt <= now
      ? user.importState.nextScheduledAt : undefined,
  }));
}

export async function claimScheduledImport(database, userId, expected, now = new Date()) {
  const state = await database.jobImportState.findUnique({ where: { userId } });
  if (!state?.scheduleTime || !state.nextScheduledAt || state.nextScheduledAt.getTime() !== expected.getTime()) {
    return false;
  }

  const result = await database.jobImportState.updateMany({
    where: {
      userId,
      scheduleTime: state.scheduleTime,
      nextScheduledAt: expected,
      user: { active: true },
    },
    data: { nextScheduledAt: nextScheduledRun(state.scheduleTime, now, true) },
  });
  return result.count === 1;
}
