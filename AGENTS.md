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
- Vorhandene Tailwind-Utilities gegenüber gleichwertigen Arbitrary Properties
  bevorzugen, etwa `wrap-anywhere` statt `[overflow-wrap:anywhere]`.
- Gemeinsame Seitenlayouts, etwa `<main>` mit Breite, Abständen und responsiven
  Regeln, in `components/ui/page/` mit `BodyWrapper`, `PageWrapper` und
  `SectionWrapper` kapseln. Seiten verwenden diese
  Komponenten, statt Layout-Markup und Styling zu wiederholen.
- Layout-Unterschiede über klar benannte Komponenten-Varianten steuern.
- CSS-Module sind optional und keine Vorgabe. Inline-Styles sind bei Bedarf
  innerhalb der gekapselten Komponenten erlaubt. Globale Design-Tokens bleiben
  in `app/globals.css`.
- Zusammengehörige Formularlogik bei Bedarf in eigene Hooks auslagern.
- Gemeinsame HTML-Grundstile wie die Darstellung von `h1` zentral in
  `app/globals.css` unter `@layer base` definieren, statt Klassen zu wiederholen.
- Links über `AppLink` und Navigationen über `Navigation` aus `components/ui/`
  zusammensetzen. Unterschiede über benannte Varianten steuern; gemeinsame
  Link- und Navigationsklassen nicht auf einzelnen Seiten duplizieren.
- Absätze, Beschreibungen und Hinweistexte über `Text` aus `components/ui/text.tsx`
  darstellen. Für unterschiedliche Zwecke die benannten Varianten verwenden;
  Textgröße, Farbe und wiederkehrende Abstände nicht in Ansichten wiederholen.
  Für Text innerhalb einer Zeile `as="span"` verwenden.
- Feldfehler über `FormMessage` aus `components/ui/form.tsx` ausgeben.
  `FormLabel` und `FormControl` übernehmen die Verknüpfung mit dem Eingabefeld.
  Allgemeine Formularfehler außerhalb eines Feldes über `FieldError` ausgeben.
- Bei UI-Änderungen auch benachbarte Ansichten auf wiederholte Textstile und
  Layoutmuster prüfen. Vorhandene UI-Bausteine erweitern oder gemeinsam genutzte
  Muster auslagern; für einzelne HTML-Tags ohne gemeinsamen Stil oder Verhalten
  keine zusätzlichen Komponenten anlegen.
- Interne Seitenrouten zentral in `lib/constants/routes.ts` pflegen und über
  `ROUTES` verwenden, auch für Weiterleitungen und Authentifizierungsziele.
  Keine fest eingetragenen Routen in Links oder Navigationsaufrufen verteilen.

## Formulare und Validierung

- Formulare mit React Hook Form und `zodResolver` umsetzen.
- Das gemeinsame shadcn-Formularmuster aus `components/ui/form.tsx` verwenden:
  `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl` und `FormMessage`.
  In Formularansichten weder `register()` noch `Controller` direkt verwenden.
  `FormField` kapselt den internen React-Hook-Form-Controller; Eingaben erhalten
  dessen Eigenschaften über `{...field}` im `render`-Callback.
- Das native `<form>` innerhalb von `Form` übernimmt das Absenden; die Logik
  bleibt bei Bedarf in einem eigenen Hook mit `useForm` und `zodResolver`.
- Zod-Schemas in `lib/schemas/` nach Fachbereich auslagern und TypeScript-Typen
  daraus ableiten.
- Frontend und Server verwenden dasselbe Schema, wenn dieselben Eingaben geprüft
  werden. Serverseitige Validierung bleibt verpflichtend.
- Feldfehler am jeweiligen Eingabefeld anzeigen und barrierefrei verknüpfen.
- Formularzustand und Absende-Status über React Hook Form verwalten.

## Abhängigkeiten und Sicherheitsprüfung

- Die shadcn-Komponenten liegen als Quellcode im Projekt. Die `shadcn`-CLI nicht
  als dauerhafte Projektabhängigkeit installieren; sie würde derzeit die
  anfällige `deepmerge`-Abhängigkeit einbringen. Benötigte CSS-Varianten lokal
  in `app/globals.css` halten, ohne Import aus dem CLI-Paket.
- Nach Änderungen an Abhängigkeiten sowohl `npm audit` als auch die
  Lockdatei-Prüfung `npm run audit:dependencies` ausführen.

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
- Bei höchstens einer Eigenschaft dürfen kurze Inhalte einzeilig bleiben,
  etwa `<h1>Projekt</h1>` oder `<AppLink href={ROUTES.login}>Anmelden</AppLink>`.
  Längere Inhalte wie „Interner Bereich“ und Absatztexte auf eigene Zeilen
  zwischen öffnendem und schließendem Tag schreiben. Der öffnende Tag darf
  dabei mit einer Eigenschaft einzeilig bleiben. Ab zwei Eigenschaften steht
  weiterhin jede Eigenschaft auf einer eigenen Zeile.
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
