import { ERRORS } from "./errors/index.mjs";
import { reportFailure } from "./common.mjs";


try {
  const base = new URL(process.env.SMOKE_BASE_URL ?? "http://localhost:3001/marketplace");
  if (![
    "https:",
    "http:"
  ].includes(base.protocol)) throw new Error(ERRORS.CONFIG);
  for (const path of [
    "",
    "/login",
    "/api/health"
  ]) {
    const response = await fetch(`${base.href.replace(/\/$/, "")}${path}`, {
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!response.ok || !response.headers.get("x-robots-tag")?.includes("noindex")) throw new Error(ERRORS.FAILED);
    await response.body?.cancel();
  }
  console.log("Marketplace-Smoke-Test erfolgreich.");
} catch (error) {
  reportFailure(error);
}
