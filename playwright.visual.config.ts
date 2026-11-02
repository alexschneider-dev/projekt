import { defineConfig } from "@playwright/test";
import { TEST_BASE_URL } from "./testing/support/environment.mjs";
import config from "./playwright.config";


export default defineConfig({
  ...config,
  snapshotPathTemplate: "{testDir}/visual/snapshots/{arg}{ext}",
  webServer: {
    command: "node testing/run.mjs visual-server",
    url: TEST_BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: config.projects?.filter(project => project.name === "visuell") ?? [],
});
