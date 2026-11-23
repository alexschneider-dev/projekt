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

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
