import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import minimatch from "../tools/minimatch-compat/index.cjs";


const require = createRequire(import.meta.url);

test("Alte und neue Schnittstellen erkennen Dateimuster", () => {
  assert.equal(minimatch("src/view.tsx", "**/*.{ts,tsx}"), true);
  assert.equal(minimatch.minimatch("src/view.js", "**/*.tsx"), false);
  assert.equal(minimatch(".hidden.ts", "*.ts"), false);
  assert.equal(minimatch(".hidden.ts", "*.ts", { dot: true }), true);
  assert.equal(minimatch("src/view.tsx", "*.tsx", { matchBase: true }), true);
  assert.equal(minimatch("src/view.tsx", "!**/*.js"), true);
  assert.equal(minimatch.makeRe("**/*.tsx").test("src/view.tsx"), true);
  assert.equal(new minimatch.Minimatch("**/*.tsx").match("src/view.tsx"), true);
});

test("Voreinstellungen bleiben aufrufbar und lassen sich kombinieren", () => {
  const dot = minimatch.defaults({ dot: true });
  const insensitive = dot.defaults({ nocase: true });

  assert.equal(dot(".hidden.ts", "*.ts"), true);
  assert.equal(dot.minimatch(".hidden.ts", "*.ts"), true);
  assert.equal(new dot.Minimatch("*.ts").match(".hidden.ts"), true);
  assert.equal(insensitive(".HIDDEN.TS", "*.ts"), true);
  assert.equal(dot.filter("*.ts")(".hidden.ts"), true);
});

test("Alle ESLint-Verbraucher laden den Adapter", () => {
  for (const name of [
    "eslint",
    "@eslint/config-array",
    "@eslint/eslintrc",
    "eslint-plugin-import",
    "eslint-plugin-react",
    "eslint-plugin-jsx-a11y",
    "@typescript-eslint/typescript-estree"
  ]) {
    const consumer = createRequire(require.resolve(name));

    assert.equal(consumer("minimatch"), minimatch, name);
  }
});

test("React-Regeln können die alte Funktionsschnittstelle aufrufen", () => {
  const { Linter } = require("eslint");
  const react = require("eslint-plugin-react");
  const linter = new Linter();
  const messages = linter.verify("const view = <Widget forbiddenValue='x' />;", [{
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: { react },
    rules: {
      "react/forbid-component-props": [
        "error",
        { forbid: [{ propNamePattern: "forbidden*" }] }
      ]
    }
  }]);

  assert.equal(messages.length, 1);
  assert.equal(messages[0].ruleId, "react/forbid-component-props");
});

test("Lockdatei verwendet die echte korrigierte minimatch-Version", () => {
  const lock = require("../package-lock.json");
  const modern = lock.packages["node_modules/minimatch-modern"];

  assert.equal(modern.name, "minimatch");
  assert.equal(modern.version, "11.0.4");
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path.endsWith("node_modules/minimatch")) {
      assert.equal(entry.link, true, path);
      assert.equal(entry.resolved, "tools/minimatch-compat", path);
    }
  }
});

test("Import-Regeln prüfen interne Module über die makeRe-Schnittstelle", () => {
  const { Linter } = require("eslint");
  const imports = require("eslint-plugin-import");
  const linter = new Linter();
  const messages = linter.verify("import value from 'paket/intern';", [{
    plugins: { import: imports },
    rules: {
      "import/no-internal-modules": [
        "error",
        { forbid: ["paket/**"] }
      ]
    }
  }]);

  assert.equal(messages.length, 1);
  assert.equal(messages[0].ruleId, "import/no-internal-modules");
});
