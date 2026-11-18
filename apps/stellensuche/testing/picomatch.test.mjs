import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import picomatch from "../tools/picomatch-secure/index.js";


const require = createRequire(import.meta.url);

test("Wiederholte Wildcard-Extglobs blockieren den Prozess nicht", () => {
  const script = `
    const assert = require('node:assert/strict');
    const picomatch = require(${JSON.stringify(require.resolve("picomatch"))});
    const posix = require(${JSON.stringify(require.resolve("picomatch/posix"))});
    for (const pattern of ['+(*)', '+(*a)', '*(a*)', '+(?*)', 'src/+(*a).ts', '+(*a|b)']) {
      for (const options of [{}, { maxExtglobRecursion: false }, { fastpaths: false }]) {
        for (const matcher of [picomatch, posix]) {
          const input = 'a'.repeat(128) + '!';
          assert.equal(matcher(pattern, options)(input), false);
          assert.equal(matcher.isMatch(input, pattern, options), false);
          assert.equal(matcher.makeRe(pattern, options).test(input), false);
          const parsed = matcher.parse(pattern, options);
          assert.equal(matcher.compileRe(parsed, options).test(input), false);
          assert.equal(matcher(pattern, options)(pattern), true);
        }
      }
    }
  `;
  const result = spawnSync(process.execPath, [
    "-e",
    script
  ], {
    timeout: 5000,
    encoding: "utf8"
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test("Dateimuster, Alternativen, Negation und wiederholte Literale bleiben nutzbar", () => {
  assert.equal(picomatch("**/*.{ts,tsx}")("src/view.tsx"), true);
  assert.equal(picomatch("**/*.ts")("src/view.js"), false);
  assert.equal(picomatch("*.ts")(".hidden.ts"), false);
  assert.equal(picomatch("*.ts", { dot: true })(".hidden.ts"), true);
  assert.equal(picomatch("*.@(ts|tsx)")("view.tsx"), true);
  assert.equal(picomatch("+(ab)")("abab"), true);
  assert.equal(picomatch("!*.js")("view.ts"), true);
  assert.equal(picomatch("**/*.ts", { ignore: "**/*.test.ts" })("src/view.test.ts"), false);
  assert.equal(picomatch.scan("src/**/*.ts").base, "src");
  assert.equal(picomatch.makeRe("**/*.ts").test("src/view.ts"), true);
});

test("Installierte Verbraucher und Lockdatei verwenden ausschließlich den lokalen Patch", () => {
  for (const name of [
    "tinyglobby",
    "fdir",
    "vite",
    "vitest"
  ]) {
    const consumer = createRequire(require.resolve(name));

    assert.equal(consumer("picomatch"), picomatch, name);
  }

  const lock = require("../package-lock.json");
  const entries = Object.entries(lock.packages).filter(([path]) => path.endsWith("node_modules/picomatch"));

  assert.ok(entries.length > 0);
  for (const [path, entry] of entries) {
    assert.equal(entry.link, true, path);
    assert.equal(entry.resolved, "tools/picomatch-secure", path);
  }
});
