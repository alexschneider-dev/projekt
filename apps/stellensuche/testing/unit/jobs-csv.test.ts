import {
  describe,
  expect,
  it,
} from "vitest";
import { parseJobCsv } from "@/lib/jobs/csv";
import { jobCsvSchema } from "@/lib/schemas/jobs/csv.schema";


describe("Stellen-CSV", () => {
  it("liest BOM, Kopfzeile, Anführungszeichen und Tracking-Varianten", () => {
    const url = "https://www.stepstone.de/stellenangebote--Test--123-inline.html";
    expect(parseJobCsv(`\uFEFF"URL"\r\n"${url}?tracking=1"\r\n\r\n${url}#oben`)).toEqual({
      urls: [url],
      duplicates: 1,
    });
  });

  it("behält fremde Links für den Vergleich bei und lehnt ungültige Inhalte ab", () => {
    expect(parseJobCsv("https://example.test/job/1").urls).toEqual(["https://example.test/job/1"]);
    for (const content of [
      "",
      "URL\n",
      "kein Link",
      '"https://example.test/job/1',
      '"https://example.test/job/1","https://example.test/job/2"',
      "https://example.test/job/1,https://example.test/job/2",
      "https://example.test/job/1;https://example.test/job/2",
      "javascript:alert(1)",
    ]) {
      expect(() => parseJobCsv(content)).toThrow();
    }
  });

  it("begrenzt Dateityp, Größe und Linkanzahl", () => {
    expect(jobCsvSchema.safeParse({ file: new File(["url"], "test.txt") }).success).toBe(false);
    expect(jobCsvSchema.safeParse({ file: new File([], "test.csv") }).success).toBe(false);
    expect(jobCsvSchema.safeParse({ file: new File(["x".repeat(2 * 1024 * 1024 + 1)], "test.csv") }).success).toBe(false);
    expect(() => parseJobCsv("https://example.test/job/1\n".repeat(10_001))).toThrow();
  });
});
