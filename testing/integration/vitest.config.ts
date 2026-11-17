import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { TEST_ENV } from "../support/environment.mjs";


export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../../", import.meta.url)) } },
  test: {
    include: ["testing/integration/*.test.ts"],
    environment: "node",
    env: TEST_ENV,
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
