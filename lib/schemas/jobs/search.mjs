import { z } from "zod";


// Die aufrufenden Werkzeuge übersetzen Schemafehler in ihre zentralen Meldungen.
export const jobSearchUrlSchema = z.string().trim().url().refine((value) => {
  const url = new URL(value);
  return url.origin === "https://www.stepstone.de"
    && url.pathname.startsWith("/jobs/")
    && !url.username
    && !url.password;
}).transform((value) => {
  const url = new URL(value);
  url.searchParams.delete("page");
  url.hash = "";
  return url.href;
});
