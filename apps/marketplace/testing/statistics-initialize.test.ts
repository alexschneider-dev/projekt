import {
  beforeEach,
  expect,
  it,
  vi
} from "vitest";
import { initializeCatalogStatistics } from "@/lib/statistics/initialize";


const mocks = vi.hoisted(() => ({
  exists: vi.fn(),
  publish: vi.fn(),
  lock: vi.fn(),
  read: vi.fn(),
  transaction: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/statistics/publish", () => ({
  hasCatalogStatistics: mocks.exists,
  publishCatalogChanged: mocks.publish
}));
vi.mock("@/lib/statistics/snapshot", () => ({
  lockCatalogStatistics: mocks.lock,
  readCatalogStatistics: mocks.read
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async callback => callback({}));
});

it("initialisiert fehlende Daten einmal aus der Datenbank und veröffentlicht nach dem Commit", async () => {
  const snapshot = {
    version: 1,
    available: true,
    products: 120,
    sellers: 3,
    revision: "1"
  };
  mocks.exists.mockResolvedValue(false);
  mocks.read.mockResolvedValue(snapshot);
  let committed = false;
  mocks.transaction.mockImplementation(async callback => {
    const result = await callback({});
    committed = true;
    return result;
  });
  mocks.publish.mockImplementation(() => { expect(committed).toBe(true); });

  await initializeCatalogStatistics();

  expect(mocks.read).toHaveBeenCalledTimes(1);
  expect(mocks.publish).toHaveBeenCalledWith(snapshot);
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.read.mock.invocationCallOrder[0]!);
});

it.each([
  true,
  null
])("ruft bei vorhandenem Stand oder Redis-Ausfall keine Datenbank ab: %s", async exists => {
  mocks.exists.mockResolvedValue(exists);

  await initializeCatalogStatistics();

  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(mocks.publish).not.toHaveBeenCalled();
});

it("überspringt die Zählung, wenn eine andere Instanz den Stand inzwischen angelegt hat", async () => {
  mocks.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

  await initializeCatalogStatistics();

  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.publish).not.toHaveBeenCalled();
});

it("lässt die Anwendung bei einem Initialisierungsfehler weiter starten", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.exists.mockResolvedValue(false);
  mocks.transaction.mockRejectedValue(new Error());

  await expect(initializeCatalogStatistics()).resolves.toBeUndefined();
  expect(mocks.publish).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
