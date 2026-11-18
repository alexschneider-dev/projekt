# Lokaler Sicherheitspatch für picomatch

Diese Variante basiert auf picomatch 4.0.7 (MIT-Lizenz, siehe `LICENSE`).
`upstream.json` enthält die SHA-256-Prüfsummen der unveränderten Ausgangsdateien.
Der übernommene Bibliothekscode bleibt zur Vergleichbarkeit in seiner ursprünglichen
Sprache und Formatierung erhalten.

## Änderung und Einschränkung

GHSA-fc5q-39xc-vjpf beschreibt exponentielles Regex-Backtracking bei wiederholten
Extglobs wie `+(*)` und `+(*a)`. Die lokale Änderung am Anfang von
`analyzeRepeatedExtglob` in `lib/parse.js` stuft Körper mit `*` oder `?` unabhängig
von der Anzahl ihrer Alternativen als riskant ein. Die bestehende Parserlogik
behandelt diese wiederholten Extglobs anschließend als Literale. Die Schutzprüfung
greift auch mit `maxExtglobRecursion: false`.

Das ist bewusst konservativ: Auch harmlose wiederholte Extglobs mit diesen Zeichen,
einschließlich maskierter Wildcards und verschachtelter Stern-Extglobs, verlieren
ihre Musterbedeutung. Normale Globs wie `**/*.ts`, Alternativen wie `@(ts|tsx)`
und wiederholte Literale wie `+(ab)` bleiben unterstützt. Diese Änderung behebt
die genannte Angriffsklasse; sie ist keine allgemeine Sicherheitsgarantie für
beliebige reguläre Ausdrücke oder zukünftige Schwachstellen.

## Installation und Prüfung

Die Anwendung bindet dieses Paket als direkte Abhängigkeit `picomatch` ein und
erzwingt es über einen npm-Override auch für transitive Verbraucher. Es werden
keine Installationsskripte zum nachträglichen Patchen benötigt. Die Docker-Builds
kopieren das Paket vor `npm ci`.

`npm run test:picomatch` prüft Angriffsmuster in einem Prozess mit Zeitlimit,
normale Glob-Funktionen und die Paketauflösung. Die Tests sind über
`testing/*.test.mjs` auch Teil der bestehenden CI-Regressionstests.

Der lokale Paketname `projekt-picomatch-secure` kennzeichnet den Fork ausdrücklich.
`npm audit` kann dessen Quellcode nicht beurteilen; ein sauberer Audit ersetzt
deshalb diese Regressionstests nicht. Sicherheitsmeldungen zu picomatch müssen
weiterhin auf ihre Relevanz für diesen Fork geprüft werden.

Sobald eine offiziell korrigierte Version verfügbar ist, den lokalen Override,
die direkte Abhängigkeit und die Docker-Einbindungen durch die veröffentlichte
Version ersetzen. Danach beide Audits, Glob-Tests, Linting, Typprüfung und Vitest
erneut ausführen.

Referenz: https://github.com/advisories/GHSA-fc5q-39xc-vjpf
