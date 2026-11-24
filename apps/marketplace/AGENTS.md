# Marktplatz

Zusätzlich zu den Repository-Regeln:

- Diese Anwendung ist unabhängig von der Stellensuche; eigene Pakete und Migrationen.
- Datenbank: Schema `marketplace`, Benutzer `marketplace_app`.
- Rollen: `CUSTOMER`, `SELLER`, `SUPER_ADMIN`; zentrale Konstanten in `lib/auth/roles.ts`.
- Öffentliche Registrierung erzeugt ausschließlich `CUSTOMER`. Verkäuferrechte nur
  über einen administrativen Ablauf vergeben. Angebote stets über die geprüfte Session begrenzen.
- Interne Links bleiben ohne Präfix; Next.js ergänzt den Build-Parameter basePath.
  Direkte HTTP-Aufrufe und NextAuth-Ziele verwenden `withBasePath`.
- Keine `next/image`-Nutzung. Bildvarianten vorab erzeugen und über R2 ausliefern.
- Ohne konfigurierte Bildquelle keine externen Fotos vortäuschen.
- Standardmäßig noindex, nofollow. Öffentliche Indexierung nur nach ausdrücklichem Auftrag.
- Prisma-Modelle nach Zweck in Unterordnern von `prisma/schema/` halten:
  `auth`, `catalog`, `offers`, `images` und `cart`. Generator und Datenquelle stehen
  direkt in `prisma/schema/schema.prisma`, damit auch der Prisma-6-Editor die
  Unterordner als gemeinsames Schema erkennt. `prisma.config.ts` bindet
  diese gemeinsam ein; Migrationen bleiben unter `prisma/migrations/`.
- Materialien, Farben, Stuhltypen und Modellnamen sind kategorienbezogene
  PostgreSQL-Stammdaten. Ausschließlich `SUPER_ADMIN` pflegt sie auf der Website.
  Verkäufer nutzen die aktive Auswahl; API-Schreibrechte serverseitig erzwingen.
  Filter und Produktgenerator lesen diese Daten, statt eigene Wertelisten zu führen.
  Bestehende Produktzuordnungen beim Deaktivieren erhalten.

- Gäste speichern ihren Warenkorb lokal im Browser. Beim Anmelden ausschließlich
  Angebots-IDs übertragen und serverseitig zusammenführen; Preise und Verfügbarkeit
  erneut prüfen. Bei Fehlern lokale Daten behalten. Nach erfolgreichem Sync Gastdaten
  entfernen; Kontodaten beim Abmelden nicht in den Gast-Warenkorb kopieren.
- Serverseitige Warenkörbe gehören ausschließlich zur geprüften Benutzer-ID.
  Maximal zehn verschiedene Produkte, ein Verkäuferangebot je Produkt, keine
  Mengen oder Bestellungen. Schreibzugriffe pro Benutzer serialisieren; die
  PostgreSQL-Grenze aus zehn eindeutigen Plätzen beibehalten.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
