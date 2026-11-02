import {
  defineConfig,
  devices,
} from "@playwright/test";
import { TEST_BASE_URL } from "./testing/support/environment.mjs";


export default defineConfig({
  testDir: "./testing",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  updateSnapshots: "none",
  reporter: [
    ["list"],
    [
      "html",
      { open: "never" }
    ],
    [
      "junit",
      { outputFile: "test-results/junit.xml" }
    ],
  ],
  use: {
    baseURL: TEST_BASE_URL,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node testing/run.mjs server",
    url: TEST_BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "pipe",
  },
  projects: [
    {
      name: "api",
      testMatch: "api/**/*.spec.ts",
    },
    {
      name: "chromium",
      testMatch: "e2e/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testMatch: "e2e/**/*.spec.ts",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: "e2e/**/*.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobil",
      testMatch: "e2e/**/*.spec.ts",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "visuell",
      testMatch: "visual/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
