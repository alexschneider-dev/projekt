/* eslint-disable @typescript-eslint/no-require-imports */
const modern = require("minimatch-modern");


// Ältere ESLint-Plugins erwarten einen direkt aufrufbaren CommonJS-Export.
// Das eigentliche Matching übernimmt ausschließlich die korrigierte Bibliothek.
function wrap(api) {
  const matcher = typeof api === "function" ? api : api.minimatch;
  const match = (path, pattern, options) => matcher(path, pattern, options);
  Object.assign(match, api);
  match.minimatch = match;
  match.defaults = options => wrap(matcher.defaults(options));
  // minimatch 11 erzeugt keine regulären Ausdrücke mehr. Die Import-Regeln
  // benötigen von makeRe ausschließlich test(); auch hier sicher matchen.
  match.makeRe = (pattern, options) => {
    const compiled = new api.Minimatch(pattern, options);

    return { test: path => compiled.match(path) };
  };

  return match;
}

module.exports = wrap(modern);
