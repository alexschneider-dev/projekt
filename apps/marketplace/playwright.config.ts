import {
  defineConfig,
  devices
} from "@playwright/test";


export default defineConfig({
  testDir: "testing/browser",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    [
      "html",
      { open: "never" }
    ]
  ],
  use: {
    baseURL: "http://localhost:3001/marketplace/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobil",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium"
      }
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3001/marketplace/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
