# minimatch-Kompatibilität für ESLint

Der Override in der Projekt-`package.json` leitet die minimatch-Verbraucher auf
diesen lokalen Adapter um. Das Matching übernimmt `minimatch` 11.0.4 unter dem
Paketalias `minimatch-modern`. Damit bleibt die echte Bibliothek einschließlich
Versionsnummer für `npm audit` sichtbar.

Der Adapter unterstützt den aufrufbaren CommonJS-Export älterer Plugins, den
benannten Zugriff über `minimatch` und kombinierbare `defaults`. Die von
`eslint-plugin-import` verwendete Funktion `makeRe` liefert ausschließlich ein
Objekt mit `test`, das über `Minimatch.match` prüft. Es handelt sich nicht um
einen vollständigen Ersatz für die frühere RegExp-Schnittstelle. Neue Verbraucher
oder Plugin-Updates müssen deshalb auf zusätzliche API-Anforderungen geprüft werden.

Prüfungen: `npm run test:minimatch`, `npm run test:glob`, `npm run check`,
`npm audit` und `npm run audit:dependencies`.

Sobald alle ESLint-Verbraucher eine korrigierte minimatch-Version direkt
unterstützen, können Adapter, Override, direkte Entwicklungsabhängigkeit und
Docker-Einbindungen entfernt werden. Anschließend die Lockdatei aktualisieren
und die Prüfungen erneut ausführen.
