# Stellenimport

Der Import lädt Suchseiten der Jobbörse ohne Browser per HTTP. Die Such-URLs stehen
in PostgreSQL in `JobSearch`. Die Migration legt die erste Such-URL an.
Vor jedem Durchlauf werden alle aktiven Einträge neu gelesen; Änderungen wirken
beim nächsten Durchlauf ohne Container-Neubau oder Neustart. Eine leere aktive
Suchliste ist zulässig und verursacht keine HTTP-Anfragen.
Neue Such-URLs können auf der geschützten Stellenseite über das Formular hinzugefügt werden. Suchparameter bleiben erhalten, nur `page`
wird gesetzt. Die Seitenzahl ist die aufgerundete Trefferzahl geteilt durch die
Ergebnisse pro Seite. Fehlende Metadaten, falsche Seiten oder wiederholte
Ergebnisse brechen den Durchlauf ab; maximal 1.000 Seiten pro Suche sind erlaubt.

## Start

Befehle im Projektverzeichnis ausführen. Die Next.js-Umgebungsdateien werden
auch für den Import geladen. `DATABASE_URL` muss auf die gewünschte PostgreSQL-
Datenbank zeigen. Zuerst die Migration anwenden und den Prisma-Client erzeugen:

```bash
npx prisma migrate deploy
npx prisma generate
```

## Such-URLs verwalten

Neue Such-URLs lassen sich nach der Anmeldung direkt auf der Seite „Stellen“
hinzufügen. Die Eingabe wird im Browser und in der API mit demselben Schema
geprüft. Vorhandene Einträge bleiben unverändert. Alternativ per Kommandozeile:

```bash
npm run jobs:search:add -- 'https://www.stepstone.de/jobs/typescript'
```

Der Befehl prüft die Adresse der unterstützten Jobbörse, entfernt `page` und das Fragment und
speichert die URL mit `active = true`. Eine bereits vorhandene, deaktivierte
Suche wird nicht automatisch reaktiviert. Es gibt keine feste Grenze von zehn
Such-URLs. Alle aktiven Suchen werden weiterhin nacheinander abgearbeitet.

Im lokalen Compose-Container funktioniert derselbe Befehl ohne npm:

```bash
docker compose --env-file .env.local -f services/development/scripts/compose.dev.yml exec jobs node scripts/jobs/add-search.mjs 'https://www.stepstone.de/jobs/typescript'
```

Alternativ direkt in PostgreSQL verwalten:

```sql
SELECT "id", "url", "active" FROM "JobSearch" ORDER BY "id";
UPDATE "JobSearch" SET "active" = false WHERE "id" = 1;
UPDATE "JobSearch" SET "active" = true WHERE "id" = 1;
```

Die Suchaufträge sind unabhängig von den gespeicherten Anzeigen. Ein
Deaktivieren oder Löschen eines Suchauftrags entfernt keine Anzeigen.

## Import ausführen

Einmaliger Import:

```bash
npm run jobs:import
```

Fortlaufender Import mit stündlichem Start, solange dieser Prozess läuft:

```bash
npm run jobs:watch
```

Auf „Such-URLs“ fordert „Alle Suchgruppen jetzt durchsuchen“ zusätzlich einen
Durchlauf an. Die API speichert den Auftrag in `JobImportState`; der laufende
Importdienst prüft im Leerlauf alle fünf Sekunden auf neue Aufträge. Wiederholte
Anfragen während eines angeforderten oder laufenden Imports werden zusammengefasst.
Die Oberfläche zeigt den Status und lädt nach Abschluss die Trefferzahlen neu.
Ohne laufenden Importdienst bleibt der Auftrag vorgemerkt. Nach einem Neustart
übernimmt der Importdienst auch einen zuvor unterbrochenen Durchlauf.
Die neue Tabelle muss vor dem Update von Next.js und Importdienst migriert werden.

Der erste Durchlauf startet sofort. Alle Anfragen laufen nacheinander mit
5–10 Sekunden Abstand. Bei HTTP 429 und Serverfehlern folgen höchstens zwei
Wiederholungen. `Retry-After` wird beachtet; ohne verwertbare Angabe wird
zunehmend länger gewartet. HTTP 403 bricht den Durchlauf ab. Weiterleitungen
werden nicht automatisch verfolgt. Bei Zeitüberschreitungen (60 Sekunden je
Abruf einschließlich Antwortinhalt) folgen ebenfalls höchstens zwei Wiederholungen
mit zusätzlichen Pausen von 60 und 120 Sekunden. Die Logs enthalten Suchgruppen-ID,
Seite, Versuch und Wartezeit. Scheitert auch der dritte Versuch, bleibt die
Trefferzahl dieser Gruppe unverändert und der Import fährt mit der nächsten Gruppe
fort. Bereits gespeicherte Stellen bleiben erhalten. Der gesamte Durchlauf wird
in diesem Fall weiterhin als fehlgeschlagen gekennzeichnet; das Abschlussprotokoll
enthält die Zahl der fehlgeschlagenen Gruppen. Andere Fehler beenden den Durchlauf.
Ein neuer Durchlauf erfolgt im nächsten Intervall oder auf manuelle Anforderung.
Beenden mit Strg+C.

Suchaufträge und Stellenanzeigen werden über Prisma verwaltet, mit demselben
Schema wie in Next.js. Der Container erzeugt seinen Prisma Client beim Build.
Nur die PostgreSQL-Advisory-Sperre verwendet eine feste `pg`-Verbindung, damit
sie unabhängig vom Prisma-Verbindungspool während des gesamten Imports hält.
Sie verhindert überlappende Durchläufe, auch bei mehreren Prozessen. Bei Verbindungsverlust
endet der Prozess. Ein Import, der länger als eine Stunde braucht, wird nicht
parallel erneut gestartet; danach gilt mindestens eine Minute Pause.

Vor jedem Einfügen werden vorhandene URLs pro Ergebnisseite abgefragt.
Tracking-Parameter und Fragmente der Anzeigen-URLs werden entfernt. Ein
Unique-Index und Prisma `createMany` mit `skipDuplicates` verhindern zusätzliche Duplikate.
Gespeichert werden ausschließlich ID, URL und Fundzeitpunkt. Bestehende
Einträge bleiben unverändert. Bereits gespeicherte Seiten bleiben bei einem
späteren Fehler erhalten; ein erneuter Durchlauf ergänzt fehlende Links.

Nach Anmeldung ist die Liste über „Stellen“ im internen Bereich erreichbar.
Die TanStack-Tabelle zeigt Stellenlinks absteigend nach Fundzeitpunkt und ID,
mit höchstens 100 Einträgen pro Seite. Die Datenbank liefert nur die jeweilige
Seite; `?page=2` hält die Auswahl beim Neuladen und in der Browserhistorie fest. PostgreSQL selbst
hat keine feste Zeilenreihenfolge; die Abfrage sorgt für neue Funde oben.
Die Liste aktualisiert sich beim erneuten Laden der Seite.

## Container

Der Docker-Build verwendet das Ziel `jobs` in `services/Dockerfile` und startet
Node direkt als Benutzer `node`. Ein zusätzlicher Cron-Dienst ist nicht nötig.
Die Such-URLs werden zur Laufzeit aus PostgreSQL gelesen.

Lokaler Start nach Anwendung der Migration auf die lokale Datenbank, aus dem
Projektverzeichnis mit `POSTGRES_PASSWORD` in `.env.local`:

```bash
docker compose --env-file .env.local -f services/development/scripts/compose.dev.yml --profile jobs up -d --build jobs
docker compose --env-file .env.local -f services/development/scripts/compose.dev.yml logs -f jobs
```

Das Profil `jobs` ist optional, damit normale Entwicklungsstarts keine externen
Suchabrufe auslösen. Ohne Container bleibt `npm run jobs:watch` verfügbar.

In Produktion definiert `production/compose.swarm.yml` den Service `jobs` mit
einer Replik, 256 MB Speicherlimit und Neustart nach einem Prozessabbruch.
Worker-Updates verwenden `stop-first`; Next.js behält `start-first`. Die
PostgreSQL-Sperre bleibt als zusätzliche Absicherung aktiv.

Der bestehende Next.js-Workflow baut auch `projekt-jobs` mit derselben Version.
Nach erfolgreicher Migration und Next.js-Bereitstellung wird der Importservice
bereitgestellt. Sein erster Start beginnt sofort mit einem Import.
Der Laufzeit-Resolver übernimmt automatisch das aktuelle Datenbank-Secret und
die Startscript-Config von Next.js, sofern kein eigener `jobs`-Eintrag existiert.
Login- und Redis-Secrets werden nicht in den Importcontainer eingebunden.
Eine zusätzliche Env-Datei für die Secret-Vorbereitung ist nicht nötig.

Auch `deploy-stack.sh` berücksichtigt den Importservice. Beim ersten Anlegen
verwendet es das zur laufenden Next.js-Version passende Import-Image; dieses
muss zuvor gebaut und veröffentlicht worden sein. Spätere Stack-Updates
behalten das tatsächlich laufende Import-Image bei. Einzelne Updates sind
mit `deploy.sh jobs VERSION` möglich. Sämtliche Betriebsparameter kommen aus
Compose; `runtime.json` ergänzt nur Laufzeitwerte und Secret-/Config-Einbindungen.

## Prüfung

Importfehler und der Start sowie Abschluss jeder Suchgruppe erscheinen im
Containerprotokoll. Fehler enthalten die Arbeitsphase, Suchgruppen-ID und Seite,
soweit diese bekannt sind, sowie HTTP-Status oder Netzwerk-/Prisma-Fehlercodes.
Ungefilterte Fehlermeldungen und Verbindungsadressen werden nicht ausgegeben.
In Produktion: `docker service logs projekt_jobs --since 1h --tail 100 --timestamps`.

```bash
node --test testing/jobs.test.mjs
npm run test:db
npm run test:jobs:db
npm run test:e2e
npm run check
```

Die Unit-Tests verwenden HTML-Beispiele und eine simulierte Datenbankverbindung.
Die Integrationstests verwenden ausschließlich die fest konfigurierte lokale
Testdatenbank auf Port 55432. Sie prüfen echte Prisma-Abfragen, Suchlistenänderungen,
Pagination, unveränderte Duplikate, Sortierung und die Sperre zwischen zwei
Datenbankverbindungen; ihre Datenänderungen werden zurückgerollt. Browsertests
prüfen Zugriffsschutz und die Reihenfolge der Links. Diese automatischen Tests
senden keine Anfragen an die Jobbörse.
