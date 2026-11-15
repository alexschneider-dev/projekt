import { prisma } from "@/lib/prisma";


export async function getJobImportState(userId: string) {
  const state = await prisma.jobImportState.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  return {
    ...state,
    requestedAt: state.requestedAt?.toISOString() ?? null,
    startedAt: state.startedAt?.toISOString() ?? null,
    finishedAt: state.finishedAt?.toISOString() ?? null,
  };
}

export async function requestJobImport(userId: string) {
  await getJobImportState(userId);

  const result = await prisma.jobImportState.updateMany({
    where: {
      userId,
      requested: false,
      running: false,
    },
    data: {
      requested: true,
      requestedAt: new Date(),
    },
  });
  return { requested: result.count > 0 };
}
