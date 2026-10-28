# Projekt-Guidelines

Diese Regeln gelten für Änderungen im gesamten Projekt. Neue ausdrückliche
Anweisungen des Nutzers haben Vorrang.

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
