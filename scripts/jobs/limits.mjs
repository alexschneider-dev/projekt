import { SUPER_ADMIN } from "../../lib/auth/role-values.mjs";
import { JOB_ERRORS } from "./errors/index.mjs";


export const USER_SEARCH_LIMIT = 1;
export const USER_JOB_LIMIT = 100;

export async function userLimits(database, userId) {
  const user = await database.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true },
  });
  return {
    searches: user.role === SUPER_ADMIN ? Infinity : USER_SEARCH_LIMIT,
    jobs: user.role === SUPER_ADMIN ? Infinity : USER_JOB_LIMIT,
  };
}

export async function withUserLock(database, userId, action) {
  const run = async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    return action(transaction, await userLimits(transaction, userId));
  };
  // Auch innerhalb einer bereits geöffneten Prisma-Transaktion nutzbar.
  return database.$transaction ? database.$transaction(run) : run(database);
}

export async function createSearch(database, data, userId) {
  return withUserLock(database, userId, async (transaction, limits) => {
    const existing = await transaction.jobSearch.findFirst({
      where: {
        userId,
        url: data.url
      }
    });
    if (existing) return 0;
    const count = await transaction.jobSearch.count({ where: { userId } });
    if (count >= limits.searches) throw Object.assign(new Error(JOB_ERRORS.searchLimit), { code: "SEARCH_LIMIT" });

    const result = await transaction.jobSearch.createMany({
      data: [{
        ...data,
        userId
      }],
      skipDuplicates: true,
    });
    return result.count;
  });
}

export async function remainingJobCapacity(database, userId) {
  const limits = await userLimits(database, userId);
  if (!Number.isFinite(limits.jobs)) return Infinity;
  return Math.max(0, limits.jobs - await database.jobListing.count({ where: { userId } }));
}
