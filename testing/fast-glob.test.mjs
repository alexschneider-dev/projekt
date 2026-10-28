import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import glob, { globSync } from "../tools/fast-glob/index.cjs";


const require = createRequire(import.meta.url);
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "projekt-glob-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const file of ["package.json", "next.config.ts", "tsconfig.json", "src/a.ts", "src/b.tsx",
    "src/c.js", "src/a.test.ts", "src/.hidden.ts", "src/deep/d.ts", "other/e.ts",
    "node_modules/ignored.ts", "packages/web/package.json", "packages/web/next.config.ts"]) {
    mkdirSync(join(dir, file, ".."), { recursive: true });
    writeFileSync(join(dir, file), file.endsWith(".json") ? "{}" : "");
  }
  symlinkSync(join(dir, "other"), join(dir, "linked"), "dir");
  return dir;
}

const cases = [
  ["Dateiendungen und Ausschlüsse", ["src/*.{ts,tsx}", "!**/*.test.ts"], {}, ["src/a.ts", "src/b.tsx"]],
  ["Versteckte Dateien", "src/.*.ts", { dot: true }, ["src/.hidden.ts"]],
  ["Ignorierte Verzeichnisse", "**/*.ts", { ignore: ["**/node_modules/**", "linked/**", "packages/**"] },
    ["next.config.ts", "other/e.ts", "src/a.test.ts", "src/a.ts", "src/deep/d.ts"]],
  ["Nur Verzeichnisse", "packages/*", { onlyDirectories: true }, ["packages/web"]],
  ["Verzeichnisse nicht automatisch durchsuchen", "src", {}, []],
  ["Begrenzte Suchtiefe", "**/package.json", { deep: 1 }, ["package.json"]],
  ["Symbolischen Links folgen", "linked/*.ts", {}, ["linked/e.ts"]],
  ["Symbolische Links beim Durchsuchen ausschließen", "**/*.ts",
    { followSymbolicLinks: false, ignore: ["src/**", "packages/**", "node_modules/**", "next.config.ts"] }, ["other/e.ts"]],
  ["Nicht vorhandenes Verzeichnis", "missing/**/*.ts", {}, []],
  ["Leere Musterliste", [], {}, []],
];
for (const [name, patterns, options, expected] of cases) {
  test(`${name}: synchrone und asynchrone Suche`, async t => {
    const cwd = fixture(t);
    assert.deepEqual((await glob(patterns, { cwd, ...options })).sort(), expected.toSorted());
    assert.deepEqual(globSync(patterns, { cwd, ...options }).sort(), expected.toSorted());
  });
}

test("Absolute Pfade und kompatible Funktionsnamen", async t => {
  const cwd = fixture(t);
  assert.equal(glob.glob, glob);
  assert.equal(glob.async, glob);
  assert.equal(glob.sync, globSync);
  const expected = [join(cwd, "src/a.ts")];
  assert.deepEqual(await glob("src/a.ts", { cwd, absolute: true }), expected);
  assert.deepEqual(globSync("src/a.ts", { cwd, absolute: true }), expected);
  assert.deepEqual(globSync(join(cwd, "src/a.ts"), { cwd }), expected);
  const mixed = ["src/a.ts", join(cwd, "src/b.tsx")];
  const mixedExpected = ["src/a.ts", join(cwd, "src/b.tsx")].sort();
  assert.deepEqual(globSync(mixed, { cwd }).sort(), mixedExpected);
  assert.deepEqual((await glob(mixed, { cwd })).sort(), mixedExpected);
});

test("Neue Optionen und ungültige Muster werden nicht still ignoriert", async () => {
  assert.throws(() => globSync("*", { objectMode: true }), /Nicht unterstützte/);
  await assert.rejects(glob("*", { stats: true }), /Nicht unterstützte/);
  assert.throws(() => globSync([""]), /Suchmuster/);
});

test("Zugriffsfehler nur mit suppressErrors unterdrücken", async t => {
  const cwd = fixture(t);
  const error = Object.assign(new Error("Kein Zugriff"), { code: "EACCES" });
  const originalSync = fs.readdirSync;
  const originalAsync = fs.readdir;
  try {
    fs.readdirSync = () => { throw error; };
    fs.readdir = (...args) => queueMicrotask(() => args.at(-1)(error));
    assert.throws(() => globSync("**/*", { cwd }), /Kein Zugriff/);
    await assert.rejects(glob("**/*", { cwd }), /Kein Zugriff/);
    assert.deepEqual(globSync("**/*", { cwd, suppressErrors: true }), []);
    assert.deepEqual(await glob("**/*", { cwd, suppressErrors: true }), []);
  } finally {
    fs.readdirSync = originalSync;
    fs.readdir = originalAsync;
  }
});

test("Alle Verbraucher lösen fast-glob zum lokalen Adapter auf", () => {
  for (const name of ["shadcn", "@shadcn/registry", "@ts-morph/common", "@next/eslint-plugin-next"]) {
    const consumer = createRequire(require.resolve(name));
    assert.equal(consumer("fast-glob"), glob, name);
  }
});

test("ts-morph findet Quelldateien über den Adapter", async t => {
  const cwd = fixture(t);
  const { Project } = require("ts-morph");
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sources = project.addSourceFilesAtPaths(join(cwd, "src/*.{ts,tsx}"));
  assert.deepEqual(sources.map(file => file.getBaseName()).sort(), ["a.test.ts", "a.ts", "b.tsx"]);
  const asyncSources = await project.addSourceFilesAtPaths(join(cwd, "other/*.ts"));
  assert.equal(asyncSources[0].getBaseName(), "e.ts");
});

test("Next.js-Lint löst Verzeichnismuster auf", t => {
  const cwd = fixture(t);
  const pluginPath = require.resolve("@next/eslint-plugin-next");
  const { getRootDirs } = require(resolve(pluginPath, "../utils/get-root-dirs.js"));
  assert.deepEqual(getRootDirs({ cwd, settings: { next: { rootDir: join(cwd, "packages/*") } } }),
    [join(cwd, "packages/web")]);
});

test("Lockdatei enthält weder braces noch micromatch", () => {
  const lock = require("../package-lock.json");
  for (const name of Object.keys(lock.packages)) {
    assert.ok(!/node_modules\/(braces|micromatch)$/.test(name), name);
  }
});
