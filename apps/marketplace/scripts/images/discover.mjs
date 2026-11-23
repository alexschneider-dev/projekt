import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {
  positiveInteger,
  reportFailure
} from "../common.mjs";
import { ERRORS } from "../errors/index.mjs";
import { manifestSchema } from "./schema.mjs";


try {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error(ERRORS.CONFIG);
  const count = positiveInteger(process.argv[2], 1000, 10000);
  const startPage = positiveInteger(process.argv[3], 1, 1000);
  const existing = await readFile("data/candidates.json", "utf8")
    .then(JSON.parse)
    .catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
  const candidates = new Map(manifestSchema.parse(existing).map((row) => [
    row.id,
    row
  ]));
  await mkdir("data", { recursive: true });
  for (let page = startPage;candidates.size < count && page < startPage + 150;page++) {
    const url = new URL("https://api.pexels.com/v1/search");
    url.search = new URLSearchParams({
      query: "chair furniture",
      per_page: "80",
      page: String(page),
    }).toString();
    const response = await fetch(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(ERRORS.SOURCE);
    const body = await response.json();
    if (!Array.isArray(body.photos)) throw new Error(ERRORS.SOURCE);
    for (const photo of body.photos) {
      if (candidates.size >= count) break;
      if (candidates.has(photo.id)) continue;
      candidates.set(photo.id, {
        id: photo.id,
        sourceUrl: photo.url,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        downloadUrl: photo.src.large2x,
        previewUrl: photo.src.medium,
        alt: photo.alt || "Stuhl",
        approved: false,
      });
    }
    await writeFile("data/candidates.json", JSON.stringify(manifestSchema.parse([...candidates.values()]), null, 2));
    console.log(
      JSON.stringify({
        ereignis: "bildkandidaten_gespeichert",
        anzahl: candidates.size,
        naechsteSeite: page + 1,
      }),
    );
    if (!body.next_page || candidates.size >= count) break;
    // Unter dem Standardlimit von 200 API-Aufrufen pro Stunde bleiben.
    await new Promise((resolve) => setTimeout(resolve, 19000));
  }
} catch (error) {
  reportFailure(error);
}
