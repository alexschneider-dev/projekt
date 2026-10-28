# Projekt-Guidelines

Diese Regeln gelten für Änderungen im gesamten Projekt. Neue ausdrückliche
Anweisungen des Nutzers haben Vorrang.

## Sprache

- Im gesamten Projekt Deutsch verwenden: für Benutzeroberflächen, Meldungen,
  Fehlertexte, Kommentare, Dokumentation und die Kommunikation mit dem Nutzer.
- Technische Bezeichner, API-Namen und vorgegebene Begriffe von Bibliotheken
  unverändert lassen, wenn sie für die technische Kompatibilität nötig sind.

## Benennung

- Namen und lokale Pfade externer Referenzprojekte nicht in Projektdateien,
  Dokumentation oder Benutzeroberflächen übernehmen.

## Komponenten und Styles

- Ansichten und wiederverwendbare UI-Bausteine in `components/` auslagern.
- `app/**/page.tsx` und Layouts auf Routing, serverseitige Zugriffsprüfung und
  Zusammensetzung der Komponenten beschränken.
- Wiederverwendbare Formularelemente und Buttons zentral in `components/ui/` halten.
- Tailwind für das Styling verwenden; Klassen zentral in den jeweiligen
  wiederverwendbaren Komponenten über `className` definieren.
- Gemeinsame Seitenlayouts, etwa `<main>` mit Breite, Abständen und responsiven
  Regeln, in `components/ui/page/` mit `BodyWrapper`, `PageWrapper` und
  `SectionWrapper` kapseln. Seiten verwenden diese
  Komponenten, statt Layout-Markup und Styling zu wiederholen.
- Layout-Unterschiede über klar benannte Komponenten-Varianten steuern.
- CSS-Module sind optional und keine Vorgabe. Inline-Styles sind bei Bedarf
  innerhalb der gekapselten Komponenten erlaubt. Globale Design-Tokens bleiben
  in `app/globals.css`.
- Zusammengehörige Formularlogik bei Bedarf in eigene Hooks auslagern.

## Formulare und Validierung

- Formulare mit React Hook Form und `zodResolver` umsetzen.
- Zod-Schemas in `lib/schemas/` nach Fachbereich auslagern und TypeScript-Typen
  daraus ableiten.
- Frontend und Server verwenden dasselbe Schema, wenn dieselben Eingaben geprüft
  werden. Serverseitige Validierung bleibt verpflichtend.
- Feldfehler am jeweiligen Eingabefeld anzeigen und barrierefrei verknüpfen.
- Formularzustand und Absende-Status über React Hook Form verwalten.

## Formatierung

- In jeder Quelldatei nach dem letzten Import genau zwei Leerzeilen vor dem
  folgenden Code setzen, etwa vor der ersten Funktion, Konstante oder
  Typdefinition. Das gilt auch, wenn dort zunächst ein Kommentar steht.
- Bei mehr als einem Eintrag jeden Eintrag auf eine eigene Zeile setzen. Das gilt
  für Objekte und Typdefinitionen, Funktionsparameter und Aufrufargumente,
  Destrukturierungen, benannte Imports/Exports und Arrays sowie JSX-Props.
  Auch kurze Ausdrücke nicht in eine Zeile zusammenziehen. Die schließende
  Klammer steht bei solchen mehrzeiligen Ausdrücken auf einer eigenen Zeile.
- Diese Regel auch auf bestehenden Code anwenden, der im Rahmen einer Änderung
  bearbeitet wird.
- JSX-Tags mit mehreren Props immer mehrzeilig schreiben: genau ein Prop bzw.
  Spread-Attribut pro Zeile, auch wenn alle Props in eine kurze Zeile passen würden.
- Die schließende Klammer `>` bzw. `/>` dann in eine eigene Zeile setzen.
- Auch bestehende Komponenten, die im Rahmen einer Änderung bearbeitet werden,
  nach dieser Regel formatieren.

```tsx
<FormField
  id="email"
  label="E-Mail"
  name="email"
  type="email"
  autoComplete="username"
  required
  maxLength={254}
  disabled={busy}
/>
```

## Login, Rollen und Navigation

- NextAuth für Login mit E-Mail und Passwort verwenden; kein Better Auth.
- Interne Rollen: `user`, `admin` und `super_admin`.
- Kundenrollen separat von internen Rollen modellieren.
- Zugriffsrechte serverseitig prüfen; ausgeblendete UI ersetzt keine Autorisierung.
- Die Homepage bleibt öffentlich und enthält einen Link zur Login-Seite.
- Keine automatische Weiterleitung zum Dashboard. Nach erfolgreichem Login zur
  Homepage navigieren; der interne Bereich bleibt über einen Link erreichbar.

## API-Kommunikation und zentrale Fehler

- Vorhandene Komponenten und Hilfsfunktionen zuerst suchen und wiederverwenden.
  Bei ausdrücklich vorgegebenen Referenzprojekten die passenden vorhandenen
  Muster übernehmen und an dieses Projekt anpassen.
- Für JSON-API-Kommunikation `fetchJson` aus `lib/http/fetch-json.ts` verwenden;
  die HTTP-Methode über die Optionen angeben.
- Eigene API-Routen mit `apiHandler` und `successResponse` aus `lib/http`
  implementieren. NextAuth behält seinen eigenen Authentifizierungsablauf.
- Body, Query und Pfadparameter serverseitig mit `checkApiRequest`,
  `checkApiQuery` und `checkApiParams` sowie den zentralen Zod-Schemas prüfen.
- Fehler zentral nach Fachbereich in `lib/http/errors/` definieren, jeweils mit
  `status`, `code` und `message`. Passende Definitionen wiederverwenden statt
  Fehlermeldungen in Services, Hooks oder Komponenten zu duplizieren.
- Keine fest eingetragenen Fehlertexte an Verwendungsstellen: Das gilt auch
  für `throw new Error(...)`, `console.error(...)`, Skripte und Zod-Validierung.
  Dort zentrale Fehlerdefinitionen verwenden; dynamischen Kontext getrennt
  übergeben oder über eine zentrale Meldungsfunktion einsetzen.
- Eigenständig ausführbare Werkzeuge und Produktionsskripte halten ihre Fehler
  in einem eigenen `errors/`-Ordner innerhalb des jeweiligen Pakets, damit keine
  Abhängigkeit von der Anwendungslaufzeit entsteht.
- Beabsichtigte API-Fehler mit `throw createApiError(...)` auslösen.
  `apiHandler` und `errorResponse` übernehmen die einheitliche Fehlerantwort
  einschließlich allgemeiner Prisma-Fehler. Interne Fehlerdetails nicht an
  den Client weitergeben.
