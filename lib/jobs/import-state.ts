import { prisma } from "@/lib/prisma";


export async function getJobImportState() {
  const state = await prisma.jobImportState.findUniqueOrThrow({ where: { id: 1 } });
  return {
    ...state,
    requestedAt: state.requestedAt?.toISOString() ?? null,
    startedAt: state.startedAt?.toISOString() ?? null,
    finishedAt: state.finishedAt?.toISOString() ?? null,
  };
}

export async function requestJobImport() {
  const result = await prisma.jobImportState.updateMany({
    where: {
      id: 1,
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
