import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";


export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: [
      "testing/unit/**/*.test.ts",
      "testing/components/**/*.test.tsx",
    ],
    environment: "jsdom",
    setupFiles: ["./testing/support/vitest-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: [
        "text",
        "html",
        "lcov",
      ],
      include: [
        "lib/auth/roles.ts",
        "lib/schemas/**/*.ts",
        "hooks/auth/**/*.ts",
        "components/auth/login-form.tsx",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
});
