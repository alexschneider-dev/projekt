/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const { isAbsolute } = require("node:path");
const tiny = require("tinyglobby");

// Unterstützt bewusst die Schnittstelle, die Next.js, shadcn und ts-morph nutzen.
// Neue Optionen müssen ausdrücklich geprüft werden, statt still ignoriert zu werden.
const supported = new Set([
  "absolute", "braceExpansion", "caseSensitiveMatch", "cwd", "deep", "dot",
  "extglob", "followSymbolicLinks", "globstar", "ignore", "onlyDirectories",
  "onlyFiles", "suppressErrors",
]);
function prepare(patterns, options = {}) {
  if (!(typeof patterns === "string" || Array.isArray(patterns)) ||
      [patterns].flat().some(pattern => typeof pattern !== "string" || !pattern)) {
    throw new TypeError("Suchmuster müssen nichtleere Zeichenketten sein.");
  }
  for (const key of Object.keys(options)) {
    if (!supported.has(key)) throw new TypeError(`Nicht unterstützte fast-glob-Option: ${key}`);
  }
  // tinyglobby unterdrückt Dateisystemfehler standardmäßig. fast-glob meldet
  // sie dagegen, außer bei ENOENT oder ausdrücklich gesetztem suppressErrors.
  let failure;
  const record = error => {
    if (error && error.code !== "ENOENT" && !options.suppressErrors) failure ??= error;
  };
  const filesystem = {};
  for (const name of ["readdir", "stat", "lstat", "realpath"]) {
    filesystem[name] = (...args) => {
      const callback = args.pop();
      return fs[name](...args, (error, value) => { record(error); callback(error, value); });
    };
    filesystem[`${name}Sync`] = (...args) => {
      try { return fs[`${name}Sync`](...args); }
      catch (error) { record(error); throw error; }
    };
  }
  const { suppressErrors, ...globOptions } = options;
  void suppressErrors;
  return {
    options: { ...globOptions, expandDirectories: false, fs: filesystem },
    result(paths) {
      if (failure) throw failure;
      // fast-glob liefert Verzeichnisse standardmäßig ohne abschließenden Slash.
      return paths.map(path => path.length > 1 ? path.replace(/\/$/, "") : path);
    },
  };
}
function groups(patterns, options) {
  const all = [patterns].flat();
  const negative = all.filter(pattern => pattern.startsWith("!"));
  const positive = all.filter(pattern => !pattern.startsWith("!"));
  if (options.absolute) return [{ patterns: all, options }];
  // fast-glob erhält absolute Eingabemuster auch ohne absolute: true.
  // tinyglobby benötigt diese Einstellung ausdrücklich, daher getrennte Gruppen.
  return [false, true].map(absolute => ({
    patterns: [...positive.filter(pattern => isAbsolute(pattern) === absolute), ...negative],
    options: { ...options, absolute },
  })).filter(group => group.patterns.length > negative.length);
}
async function glob(patterns, options) {
  const request = prepare(patterns, options);
  const results = await Promise.all(groups(patterns, request.options)
    .map(group => tiny.glob(group.patterns, group.options)));
  return request.result([...new Set(results.flat())]);
}
function globSync(patterns, options) {
  const request = prepare(patterns, options);
  const results = groups(patterns, request.options)
    .flatMap(group => tiny.globSync(group.patterns, group.options));
  return request.result([...new Set(results)]);
}
module.exports = glob;
module.exports.glob = glob;
module.exports.async = glob;
module.exports.sync = globSync;
module.exports.globSync = globSync;
