import { prisma } from "@/lib/prisma";
import { ERROR_STATISTICS } from "@/lib/http/errors/statistics";
import {
  hasCatalogStatistics,
  publishCatalogChanged
} from "./publish";
import {
  lockCatalogStatistics,
  readCatalogStatistics
} from "./snapshot";


// Einmal beim Anwendungsstart aufrufen; niemals durch Besucher oder einen Intervalltimer.
export async function initializeCatalogStatistics() {
  try {
    if (await hasCatalogStatistics() !== false) return;

    const snapshot = await prisma.$transaction(async tx => {
      await lockCatalogStatistics(tx);
      // Eine andere Instanz kann den Stand während des Wartens bereits veröffentlicht haben.
      if (await hasCatalogStatistics() !== false) return null;

      return readCatalogStatistics(tx);
    });
    if (snapshot) await publishCatalogChanged(snapshot);
  } catch {
    // Die Live-Anzeige darf den Start der übrigen Anwendung nicht verhindern.
    console.error(ERROR_STATISTICS.INITIALIZE);
  }
}
