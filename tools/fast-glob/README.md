# Dateisuche ohne braces

Dieses lokale Paket ersetzt `fast-glob` durch `tinyglobby`. Es entfernt damit die
Abhängigkeiten `micromatch` und `braces`, ohne shadcn, ts-morph oder die aktiven
Next.js-Lint-Regeln abzuschalten.

Die Hauptanwendung bindet es über `file:./tools/fast-glob` ein. Der npm-Override
`"fast-glob": "$fast-glob"` verweist alle indirekten Verbraucher auf dieselbe
Abhängigkeit. Eine relative Dateiangabe nur im Override kann npm relativ zum
jeweiligen Verbraucher auflösen und dadurch ungültige Verknüpfungen erzeugen.

Der Adapter unterstützt die verwendeten Aufrufe als Funktion sowie `.glob`,
`.async`, `.sync` und `.globSync`. Er berücksichtigt die Unterschiede bei
absoluten Mustern, abschließenden Verzeichnis-Slashes, automatischer
Verzeichnissuche und unterdrückten Dateisystemfehlern. Weitere Optionen werden
ausdrücklich abgelehnt. Streams, Dateistatistiken und die übrigen Hilfsfunktionen
von fast-glob werden nicht angeboten; die derzeitigen Verbraucher benötigen sie nicht.

Bei Änderungen an shadcn, ts-morph oder ESLint muss `npm run test:glob` bestehen.
Die Tests prüfen Suchmuster, Fehlerbehandlung, Paketauflösung und Aufrufe der
Verbraucher. Der Build-Workflow führt sie direkt nach `npm ci` aus.

Beide Dockerfiles kopieren dieses Paket vor der Installation der Abhängigkeiten.
Auch die Produktions-Buildstufe benötigt das Verzeichnis, weil npm eine lokale
Verknüpfung in `node_modules` erstellt.
