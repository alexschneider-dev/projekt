import {
  describe,
  expect,
  it,
} from "vitest";
import {
  jobsQuerySchema,
  jobSearchSchema,
} from "@/lib/schemas/jobs/jobs.schema";
import {
  createPageQueryString,
  createQueryHref,
  createJobsQueryString,
} from "@/lib/shared/search-params/query-state";
import { paginationPages } from "@/lib/shared/pagination";


describe("Stellen: Validierung und URL-Zustand", () => {
  it("zeigt erste, letzte und benachbarte Seiten mit Auslassungszeichen", () => {
    expect(paginationPages(1, 1)).toEqual([1]);
    expect(paginationPages(1, 3)).toEqual([
      1,
      2,
      3,
    ]);
    expect(paginationPages(5, 10)).toEqual([
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      10,
    ]);
    expect(paginationPages(1_000_000, 1_000_000)).toEqual([
      1,
      "ellipsis",
      999_999,
      1_000_000,
    ]);
  });

  it("prüft Statuswerte und erhält Filter beim Seitenwechsel", () => {
    expect(jobsQuerySchema.parse({ status: "BEWORBEN" }).status).toBe("BEWORBEN");
    expect(jobsQuerySchema.parse({ status: "PENDING" }).status).toBe("PENDING");
    expect(jobsQuerySchema.parse({ status: "NICHT_PASSEND" }).status).toBe("NICHT_PASSEND");
    expect(jobsQuerySchema.parse({ status: "AUSGELAUFEN" }).status).toBe("AUSGELAUFEN");
    expect(jobsQuerySchema.parse({}).status).toBeUndefined();
    expect(jobsQuerySchema.safeParse({ status: "0" }).success).toBe(false);
    expect(createJobsQueryString("quelle=test&page=3", 1, "PENDING")).toBe("quelle=test&status=PENDING");
    expect(createJobsQueryString("quelle=test&status=PENDING", 2, "PENDING"))
      .toBe("quelle=test&page=2&status=PENDING");
    expect(createJobsQueryString("quelle=test&status=BEWORBEN&page=2", 1)).toBe("quelle=test");
  });

  it("normalisiert Such-URLs und lehnt fremde Hosts ab", () => {
    const result = jobSearchSchema.parse({
      title: "Testsuche",
      url: "https://www.stepstone.de/jobs/test?page=2&q=test#oben",
    });
    expect(result.url).toBe("https://www.stepstone.de/jobs/test?q=test");
    for (const url of [
      "",
      "keine-url",
      "http://www.stepstone.de/jobs/test",
      "https://example.org/jobs/test",
      "https://www.stepstone.de/andere-seite",
      "https://name:passwort@www.stepstone.de/jobs/test",
      "x".repeat(4097),
    ]) {
      expect(jobSearchSchema.safeParse({
        title: "Testsuche",
        url,
      }).success).toBe(false);
    }
  });

  it("verlangt einen nicht leeren Titel mit höchstens 200 Zeichen", () => {
    for (const title of [
      "",
      "   ",
      "x".repeat(201),
    ]) {
      expect(jobSearchSchema.safeParse({
        title,
        url: "https://www.stepstone.de/jobs/test",
      }).success).toBe(false);
    }
  });

  it("akzeptiert nur gültige Seitennummern", () => {
    expect(jobsQuerySchema.parse({}).page).toBe(1);
    expect(jobsQuerySchema.parse({ page: "2" }).page).toBe(2);
    for (const page of [
      "0",
      "-1",
      "1.5",
      "abc",
      "1000001",
    ]) {
      expect(jobsQuerySchema.safeParse({ page }).success).toBe(false);
    }
  });

  it("bewahrt andere Suchparameter und entfernt Seite 1", () => {
    expect(createPageQueryString("filter=a&filter=b&page=3", 2)).toBe("filter=a&filter=b&page=2");
    expect(createPageQueryString("filter=a&page=2", 1)).toBe("filter=a");
    expect(createQueryHref("/beispiel", "")).toBe("/beispiel");
    expect(createQueryHref("/beispiel", "page=2")).toBe("/beispiel?page=2");
  });
});
