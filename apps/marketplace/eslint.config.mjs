import {
  defineConfig,
  globalIgnores
} from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";


const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["components/catalog/product-image.tsx"],
    // R2 liefert bereits begrenzte WebP-Varianten mit srcset.
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    files: ["components/account/offers-table.tsx"],
    // TanStack Table wird ohne React Compiler eingesetzt.
    rules: { "react-hooks/incompatible-library": "off" },
  },
  // Die standardmäßigen Ausschlüsse von eslint-config-next überschreiben.
  globalIgnores([
    // Standardmäßige Ausschlüsse von eslint-config-next:
    ".next/**",
    ".next-test/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Lizenzierter Fremdcode; die lokale Änderung wird durch Regressionstests geprüft.
    "tools/picomatch-secure/index.js",
    "tools/picomatch-secure/posix.js",
    "tools/picomatch-secure/lib/**",
  ]),
]);

export default eslintConfig;
