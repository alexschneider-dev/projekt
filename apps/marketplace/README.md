# Marktplatz

Eigenständige Next.js-Anwendung für einen öffentlichen Stuhlkatalog mit mehreren
Verkäufern. Die Stellensuche bleibt unverändert. Diese Anwendung läuft standardmäßig
unter `/marketplace`, lokal über den Hauptproxy unter `https://localhost/marketplace`.

## Erster Funktionsumfang

- Servergerenderte Produktliste auf der Homepage, URL-Filter für Suche, Material,
  Farbe, Stuhltyp und Preis; Sortierung und begrenzte Seitennavigation.
- Produktdetailseiten mit Eigenschaften und mehreren Verkäuferangeboten.
- Mobile Navigation und aufklappbare Filter, lokale shadcn-Formularbausteine,
  React Hook Form/Zod, React Query und TanStack Table für eigene Verkäuferangebote.
- NextAuth mit E-Mail/Passwort, Resend-Bestätigung, gehashten befristeten Tokens,
  PostgreSQL-Limits und widerrufbaren Sessions.
- Rollen `CUSTOMER`, `SELLER`, `SUPER_ADMIN`. Öffentliche Registrierung erzeugt
  ausschließlich Kunden. Verkäufer und Super Admin werden über das lokale CLI angelegt.
  Verkäufer sehen maximal die ersten 100 eigenen Angebote; Bearbeitung und Bestellungen
  gehören noch nicht zu diesem ersten Stand.
- Titel, Beschreibungen, Canonical und Open Graph; HTML und HTTP-Header setzen
  ausdrücklich **noindex, nofollow**. Damit werden die Seiten nicht für Google
  freigegeben. `robots.txt` erlaubt Crawling, damit Suchmaschinen noindex lesen können.
- Eigene Bildpipeline mit Sharp und R2. Kein `next/image`, keine Cloudflare Images-
  Transformationen zur Laufzeit. Ohne konfigurierten Import erscheinen ehrliche Platzhalter.

## Lokal starten

Node 22.23.1 verwenden. Alle Befehle aus diesem Anwendungsordner ausführen:

```bash
npm ci
cp .env.example .env.local
```

In der **bestehenden gemeinsamen PostgreSQL-Datenbank** das Schema `marketplace`
und den Benutzer `marketplace_app` mit dem vorhandenen Werkzeug
`../../infrastructure/postgres/provision-app.sql` einrichten (`app_schema=marketplace`).
Siehe die [Datenbankanleitung](../../infrastructure/postgres/README.md).
Die Anwendungs-URL muss `schema=marketplace` und den eingeschränkten Benutzer enthalten.
Keine produktiven Zugangsdaten für Tests verwenden.

`NEXTAUTH_SECRET` lokal zufällig erzeugen, z. B. `openssl rand -hex 32`, und in
`.env.local` eintragen. NextAuth benötigt einen anderen Schlüssel als die Stellensuche.
Für Prisma-Befehle lädt der folgende Node-Aufruf die lokale Konfiguration:

```bash
node --env-file=.env.local node_modules/prisma/build/index.js generate
node --env-file=.env.local node_modules/prisma/build/index.js migrate deploy
npm run dev
```

Adresse ohne Docker-Proxy: `http://localhost:3001/marketplace`. Die Runtime liest `.env.local`; Prisma
lädt diese Datei selbst nicht automatisch. Ohne Resend-Konfiguration ist der
E-Mail-Versand geschlossen, bestehende Konten können sich weiterhin anmelden.

## Stammdaten auf der Website

Unter `/marketplace/verwaltung` findet ausschließlich `SUPER_ADMIN` die Links
zu den Stammdaten. Materialien, Farben, Stuhltypen und Modellnamen haben jeweils
eine eigene Tabellenseite unter `/marketplace/verwaltung/materialien`, `/farben`,
`/stuhltypen` beziehungsweise `/modellnamen` (jeweils unter `/marketplace/verwaltung`).
Der Plus-Link öffnet die Anlegeseite `/neu`; der Klick auf eine Tabellenzeile oder
Bezeichnung öffnet `/[id]`. Auch per Tastatur ist jede Bezeichnung als Link erreichbar.
Nach dem Anlegen wird direkt die Bearbeitungsseite des neuen Eintrags geöffnet. Einträge lassen sich anlegen,
umbenennen, deaktivieren und wieder aktivieren. Verkäufer verwenden dieselben
aktiven Einträge; sie dürfen keine Stammdaten ändern. Die bisherige Verkäuferansicht
zeigt Angebote; ein Formular zum Anlegen neuer Produkte ist noch nicht enthalten.

Die API liegt unter `/marketplace/api/materials`, `/colors`, `/chair-types` und
`/model-names` (jeweils unter `/marketplace/api`). `GET` liefert aktive Einträge,
`POST` legt einen Eintrag an. `GET /[id]`, `PATCH /[id]` und `DELETE /[id]`
lesen, ändern oder deaktivieren einen Eintrag. Schreiboperationen benötigen eine
Super-Admin-Session und den Origin der Website. Body für POST/PATCH:
`{ "label": "Eiche", "active": true }`. Listen und POST unterstützen
`?categoryId=chairs`; `?includeInactive=true` ist nur Super-Admins erlaubt.
Die öffentlichen GET-Endpunkte werden auch für Verkäufer und Katalogfilter verwendet.

Text-Eigenschaften referenzieren PostgreSQL-Stammdaten über einen zusammengesetzten
Fremdschlüssel. Umbenennungen aktualisieren die Eigenschaftswerte bestehender Produkte;
individuelle Produkttitel und Beschreibungen werden nicht umgeschrieben. Deaktivieren
entfernt keine Produktzuordnungen. Migrationen übernehmen vorhandene Textwerte,
legen aber keine feste Liste von Materialien, Farben oder Modellnamen an.

Der Generator liest ausschließlich aktive Werte aus PostgreSQL. Vor dem ersten
Import auf der Website mindestens einen Eintrag in jedem der vier Bereiche anlegen.
Bei fehlenden Stammdaten bricht er vor dem Anlegen von Verkäufern oder Produkten ab.
Die Dateien unter `testing/` enthalten ausschließlich isolierte Testdaten für CI.

Prisma ist nach Zweck in Unterordner von `prisma/schema` gegliedert: `auth`,
`catalog`, `offers` und `images`. Die zentrale Datei `prisma/schema/schema.prisma`
enthält Generator und Datenquelle und ermöglicht die ordnerübergreifende
Modellerkennung in der Prisma-6-Erweiterung. `prisma.config.ts` lädt alle Modelle; die gemeinsame Migrationshistorie
bleibt unter `prisma/migrations`. Nach dem Aktualisieren des Codes die Migrationen
selbst anwenden und den Prisma-Client neu erzeugen; beim Docker-Workflow die App neu
bauen. Der Generator führt keine Migrationen aus.

## Datenmodell und große Datenmengen

`Product` enthält gemeinsame Produktdaten, `Offer` die Preise und Bestände eines
Verkäufers. `Category`, `AttributeDefinition` und `ProductAttribute` unterstützen
kategoriespezifische Text-, Zahlen- und boolesche Eigenschaften. Zusammengesetzte
Fremdschlüssel verhindern Eigenschaften aus einer anderen Kategorie. Indizes
unterstützen Kategorie-, Eigenschafts-, Preis- und Verkäuferabfragen. Die Oberfläche
und der Generator implementieren zunächst ausschließlich Stühle.

```bash
npm run data:seed -- 10000
npm run data:seed -- 1000000
# Optional: Zielmenge und nächste ID nach einem Abbruch
npm run data:seed -- 10000000 1000001
```

500 Produkte pro Transaktion, deterministische IDs und Inhalte, 1–3 Angebote pro
Produkt. Ein erneuter Lauf ergänzt fehlende Datensätze ohne bestehende Daten zu
löschen. Demo-Verkäufer sind deaktiviert und besitzen zufällige unbekannte Passwörter.
Der Generator ist für eine separate Demo-Installation vorgesehen. Die IDs 1 bis
10.000.000 sind für generierte Produkte reserviert.

Die erfolgreiche Erstellung kleiner Testdaten beweist keine ausreichende Leistung
bei zehn Millionen Produkten. Vor einer solchen Vergrößerung Speicher, Importdauer,
Query-Pläne und Last messen. Preisaggregation und tiefe Offset-Seiten sind bekannte
Skalierungsgrenzen. Seitentiefe ist auf 1.000 begrenzt; die genaue Trefferzahl wird einschließlich der aktiven Filter angezeigt.
Kein serverseitiger Cache für Benutzer- oder Verkäuferdaten. React Query hält
öffentliche Ergebnisse 30 Sekunden im Browser frisch.

## 1.000 Demo-Produkte ohne Bilder

Als Super Admin unter `/marketplace/verwaltung` auf **Weitere 1.000 Demo-Produkte hinzufügen** klicken.
Die Website verwendet die geschützte API; ein Seed-Aufruf ist dafür nicht nötig.
Vorher aktive Materialien, Farben, Stuhltypen und Modellnamen in der Verwaltung anlegen.
Jeder Klick erzeugt weitere 1.000 Produkte. Vorhandene Produkte werden nicht überschrieben. Details stehen unten unter
„Demo-Produkte über die Website/API“. Die Skripte bleiben für isolierte Tests und
optionale große Lasttest-Datensätze verfügbar.

## Bilder: Pexels → Auswahl → Sharp → R2

1. Eigenen Pexels-Schlüssel in `.env.local` eintragen.
2. `npm run images:discover -- 1000` sammelt bis zu 1.000 Kandidaten. Das ist keine
   Zusicherung von 1.000 geeigneten Stuhlmotiven. Bereits gefundene IDs werden
   wiederverwendet. Bei Bedarf kann als zweites Argument eine Fortsetzungsseite
   angegeben werden. Das Skript wartet zwischen API-Aufrufen 19 Sekunden und
   stoppt bei Anbieterfehlern, statt unbegrenzt erneut anzufragen.
3. `npm run images:review` erzeugt `data/review.html`. Lokal öffnen, geeignete Bilder
   auswählen, Material/Farbe/Typ und deutschen Alternativtext prüfen. Die exportierte
   `approved.json` nach `data/approved.json` verschieben. Diese Auswahl enthält keine Schlüssel.
4. Eigenen **leeren, ausschließlich für diese Bilder verwendeten** R2-Bucket mit
   Standard Storage einrichten. Bucket-begrenzte Zugangsdaten und eine eigene
   öffentliche Bilddomain in `.env.local` setzen. Keine Backup-Buckets veröffentlichen.
5. `R2_IMAGE_BUDGET_BYTES` auf das bestätigte freie Budget des gesamten R2-Kontos
   setzen. Standard: 200 MB; technische Obergrenze des Importers: 2 GB.
6. `npm run images:import` verarbeitet nur bestätigte Bilder. Quellen sind auf
   `images.pexels.com` beschränkt; Weiterleitungen, Dateien über 10 MB und Bilder
   über 25 Millionen Pixel werden abgewiesen. Drei quadratische WebP-Varianten
   (160/480/960 px) erhalten zusammen höchstens 200 KB. Metadaten werden entfernt.
7. Danach Produkte erzeugen oder `npm run images:assign` für bestehende bildlose
   Demoprodukte ausführen. Die Zuordnung berücksichtigt Material, Farbe und Stuhltyp.
   Produkte ohne passendes Motiv behalten ihren Platzhalter.

Der Import listet den tatsächlichen Bucket-Inhalt, dedupliziert über SHA-256,
überspringt bereits importierte Motive und serialisiert Importe über eine lokale
Sperre sowie einen PostgreSQL-Advisory-Lock. Unvollständige Uploads können beim
nächsten Lauf wiederverwendet werden. Keine Originaldateien werden in R2 aufbewahrt.
Nach einem harten Prozessabbruch `data/import.lock` erst entfernen, wenn kein eigener
Import mehr läuft. Andere Werkzeuge dürfen diesen Bucket währenddessen nicht beschreiben.

Pexels- und Fotografenlinks erscheinen unter „Bildnachweise“. Lizenz und API-Regeln:
https://www.pexels.com/license/ und https://www.pexels.com/api/documentation/.

**Kosten:** 1.000 Motive benötigen höchstens 200 MB, 10.000 höchstens 2 GB und
30.000 Bildobjekte. Die Freimengen gelten kontoweit, einschließlich bestehender
Backups/Logs: https://developers.cloudflare.com/r2/pricing/.
Der Import schützt das konfigurierte Speicherbudget, er ist **keine Kontosperre für
R2-Kosten**. Öffentliche Reads, andere Buckets, vorhandene Monatsnutzung und fremde
Schreibzugriffe kann er nicht begrenzen. Eine garantierte Null-Euro-Veröffentlichung
benötigt zusätzlich eine kontoweite Verbrauchs- und Abschaltstrategie. Bis dahin
keinen unbegrenzt erreichbaren öffentlichen Bildbucket als kostenfrei garantieren.
CDN-Caching über eine eigene Domain und unveränderliche Bildpfade reduziert Reads.

## Konten anlegen

Im Anwendungsordner denselben Aufruf wie in der Stellensuche verwenden:

```sh
npm run auth:create-user -- info@example.com SUPER_ADMIN "Alex"
```

Das Passwort wird verdeckt mit Bestätigung abgefragt (12–128 Zeichen). Rolle und
Name sind optional; ohne Rolle wird `CUSTOMER` verwendet. Erlaubte Rollen sind
`CUSTOMER`, `SELLER` und `SUPER_ADMIN`. Für Verkäufer kann
`MARKETPLACE_SELLER_NAME` weiterhin den Geschäftsnamen vorgeben.
Das CLI erstellt neue Konten und überschreibt keine vorhandenen Konten.
`MARKETPLACE_USER_EMAIL`, `MARKETPLACE_USER_PASSWORD` und `MARKETPLACE_USER_ROLE`
werden nicht mehr verwendet. Die Datenbankkonfiguration bleibt in `.env.local`.

Vom Repository-Hauptordner aus:

```sh
npm run auth:create-user:marketplace -- info@example.com SUPER_ADMIN "Alex"
npm run auth:create-user:stellensuche -- info@example.com SUPER_ADMIN "Alex"
```

Der bisherige Root-Befehl `auth:create-user` bleibt aus Kompatibilitätsgründen
auf die Stellensuche gerichtet.

## Observability und Bereitstellung

[Integrationsplan](../../docs/marketplace-betrieb.md). Telemetrie verwendet den
Dienstnamen `marketplace`, OTLP an Alloy und Prometheus auf dem internen Port 9465.
Metriken sind nicht für den öffentlichen Nginx vorgesehen. Logs enthalten
Route-Templates und Trace-IDs, keine Passwörter, Tokens oder konkreten Suchanfragen.

`NEXT_PUBLIC_BASE_PATH` ist ein Build-Parameter. Änderungen benötigen einen neuen
Build. `NEXTAUTH_URL` zeigt vollständig auf `/marketplace/api/auth`. Eigene
Cookie-Namen und Cookie-Pfade verhindern Konflikte mit der Stellensuche.

```bash
npm run check
npm test
npm audit
npm run audit:dependencies
npm run build
```

Datenbanktests laufen nur mit `MARKETPLACE_TEST_DATABASE=true` gegen eine isolierte
lokale Datenbank an Port 55439. Dafür die Migration und 120 Demoprodukte einspielen;
zusätzlich ein unzugängliches Schema `stellensuche` mit `private_test` anlegen.
`npm run test:http` prüft die an Port 3001 gestartete Testanwendung einschließlich
Login, Rollenrechten, Cookie-Pfad und Session-Widerruf. Die Testkonten bleiben
nur in dieser wegwerfbaren Testdatenbank. Ohne diese Einrichtung werden DB-/HTTP-
Tests ausdrücklich übersprungen. Echte E-Mails und R2-Uploads sind keine lokalen Tests.

## Docker-Entwicklung und GitHub Actions

`npm run dev:services` startet ausschließlich den Marketplace aus seiner eigenen
`services/development/scripts/compose.dev.yml` mit Compose Watch. Die gemeinsame
Entwicklungsdatenbank und das externe Netzwerk müssen bereits eingerichtet sein. `npm run dev:stop` beendet nur diese Anwendung. Details und
Voraussetzungen stehen im [Betriebsablauf](../../docs/marketplace-betrieb.md).

- `marketplace-tests.yml`: unabhängige Prüfungen einschließlich isolierter Datenbank,
  HTTP-Authentifizierung, Desktop/Mobil und Barrierefreiheit.
- `marketplace-deploy.yml`: manueller versionierter Release,
  Prüfungen vor Build, getrennte Web-/Migrationsimages, optionaler Deploy.
- `infrastructure-nginx.yml`: gemeinsamer Proxy aus `infrastructure/nginx`, separat
  geprüft und bereitgestellt.

Lokale vollständige Tests mit Docker und `psql` (nur wegwerfbare Datenbank):

```bash
npm run test:db:up
set -a
source testing/.env.example
set +a
psql -X -f testing/setup.sql
npx prisma generate
npx prisma migrate deploy
psql -X -f testing/master-data-fixture.sql
npm run data:seed -- 120
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:db:down
```

Der HTTP-Test benötigt zusätzlich die gestartete Anwendung mit denselben Test-
Umgebungsvariablen. `npm run test:db:down` entfernt ausschließlich die testbezogenen
Compose-Ressourcen, niemals die gemeinsame Entwicklungsdatenbank.

### Demo-Produkte über die Website/API

Als Super Admin unter `/marketplace/verwaltung` auf **Weitere 1.000 Demo-Produkte hinzufügen** klicken.
Der Button ruft `POST /marketplace/api/admin/demo-products` mit der angemeldeten Session auf.
Vorher Materialien, Farben, Stuhltypen und Modellnamen auf ihren Verwaltungsseiten pflegen.
Die API verwendet aktive PostgreSQL-Stammdaten, legt bei Bedarf zwölf deaktivierte
Demo-Verkäuferkonten an und erzeugt pro Aufruf weitere 1.000 Produkte mit eigenen URLs.
Sie erzeugt keine Bilder, überschreibt keine bestehenden Produkte und ist gegen
parallele Aufrufe abgesichert. Jeder Aufruf erzeugt eine neue Serie mit eindeutigen URLs.
Ein manuell ausgeführtes Seed-Skript ist für diesen Ablauf nicht erforderlich.

### Gast-Warenkorb und Anmeldung

Gäste speichern bis zu zehn verschiedene Produkte im lokalen Browserspeicher.
Beim Anmelden führt `POST /marketplace/api/cart/sync` die Angebots-IDs mit dem
Kontowarenkorb zusammen. Bestehende Kontoprodukte haben Vorrang. Nicht verfügbare
oder überzählige Angebote werden mit einem Hinweis auf der Warenkorbseite übersprungen.
Bei einem Netzwerkfehler bleiben die Gastdaten für einen erneuten Versuch erhalten.
Angemeldete Benutzer ändern ihren Warenkorb über die API; Preise und Verfügbarkeit
stammen dann aus PostgreSQL. Beim Abmelden wird der Kontowarenkorb nicht lokal übernommen.

### Produkt-URLs

Öffentliche Produktlinks enthalten die stabile Produkt-ID sowie Farbe, Material,
Breite und Sitzhöhe, beispielsweise
`/marketplace/produkte/stuhl-995-natur-polster-45cm-breit-46cm-sitzhoehe`.
Preise werden nicht verwendet. Vorhandene gespeicherte URLs und frühere
Eigenschaftsvarianten leiten mit HTTP 308 auf die aktuelle kanonische URL weiter.
Die bestehende Einstellung `noindex, nofollow` bleibt aktiv.
