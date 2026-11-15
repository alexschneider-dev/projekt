import { prisma } from "@/lib/prisma";


export async function listJobSearches() {
  return prisma.jobSearch.findMany({
    select: {
      id: true,
      url: true,
      active: true,
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });
}
