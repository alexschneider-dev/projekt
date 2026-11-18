import { defineConfig } from "@playwright/test";
import { TEST_ERRORS } from "./testing/errors/index.mjs";


const target = process.env.SMOKE_BASE_URL;
let url: URL | undefined;

try {
  url = target ? new URL(target) : undefined;
} catch {
  throw new Error(TEST_ERRORS.INVALID_SMOKE_URL);
}

if (!url || ![
  "http:",
  "https:"
].includes(url.protocol) || url.username || url.password) {
  throw new Error(TEST_ERRORS.INVALID_SMOKE_URL);
}

export default defineConfig({
  testDir: "./testing/smoke",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: url.origin,
    trace: "off",
  },
});
