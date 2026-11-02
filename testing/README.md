# Tests

Die Tests verwenden künstliche Daten. Die Entwicklungs- und Produktionsdatenbank
werden nicht verwendet. Docker (Docker Desktop oder Colima), Node.js 22 ab 22.22.2 und npm
müssen lokal verfügbar sein.

## Schnellstart

```sh
npm ci
npx prisma generate
npx playwright install chromium firefox webkit
npm run test:all
```

`test:all` führt ESLint, TypeScript, bestehende Regressionstests, Unit- und
Komponententests mit Abdeckungsprüfung, API-/Browsertests und Screenshotvergleiche aus.
Beim ersten Lauf werden zusätzlich Docker-Images und Browser heruntergeladen.
Die Browsertests bauen die Anwendung mit `next build` und starten `next start`.
Der Testbuild liegt getrennt von der Entwicklungsanwendung unter `.next-test/`.
Die Browsermatrix mit Firefox und WebKit läuft separat über `npm run test:browsers`.

## Lokale Datenbank und automatische Testdaten

Eine eigene PostgreSQL-17-Instanz läuft im Compose-Projekt `projekt-tests` auf
`127.0.0.1:55432`. Ein vorhandenes PostgreSQL auf Port 5432 bleibt unberührt.
Die Datenbank heißt `projekt_test`; Benutzername und lokales Testpasswort lauten
jeweils `projekt_test`. Die Verbindung ist in `support/environment.mjs` festgelegt.
Eine externe `DATABASE_URL` wird für Testprozesse gezielt überschrieben.

`npm run test:e2e` und `npm run test:browsers` erledigen automatisch:

1. Testdatenbank starten und auf Bereitschaft warten.
2. Prisma Client generieren und vorhandene Migrationen anwenden.
3. Vier feste Konten anlegen bzw. auf ihren Ausgangszustand zurücksetzen.
4. Anwendung bauen, Testserver auf Port 3100 starten und Tests ausführen.
5. Testserver beenden. Die Datenbank bleibt für weitere lokale Läufe verfügbar.

| E-Mail | Rolle | Zustand |
|---|---|---|
| `user@example.test` | `USER` | Aktiv |
| `admin@example.test` | `ADMIN` | Aktiv |
| `super-admin@example.test` | `SUPER_ADMIN` | Aktiv |
| `inaktiv@example.test` | `USER` | Deaktiviert |

Passwort dieser ausschließlich lokalen Konten: `Nur-fuer-lokale-Tests-2026!`.
Die Daten enthalten keine echten Personen oder Geheimnisse.

```sh
# Datenbank und feste Testkonten ohne Browsertests vorbereiten
npm run test:db

# Anwendung mit diesen Daten zum manuellen Testen starten
npm run test:server
# Danach http://127.0.0.1:3100 öffnen; mit Strg+C beenden.

# Ausschließlich die Testdatenbank samt flüchtigen Daten entfernen
npm run test:db:down
```

Die Daten liegen im flüchtigen Container-Dateisystem. Nach dem Entfernen wird die
Datenbank beim nächsten Testlauf frisch migriert. Für eine Prüfung sämtlicher
Migrationen von Null zuerst `test:db:down` ausführen. CI beginnt immer frisch.

Automatische Tests verwenden zusätzliche Konten mit eindeutigen E-Mail-Adressen.
Ihre Konten und Login-Limits werden nach jedem Test auch bei Fehlern entfernt.
Dadurch können Rollen-, Login- und Sessiontests parallel laufen. Bei einem harten
Prozessabbruch können Testkonten verbleiben; `test:db:down` entfernt sie.
Nicht mehrere komplette Testläufe gleichzeitig starten: Serverport und
Testbuild-Verzeichnis gehören jeweils einem Lauf. Ein schon laufender Server
wird absichtlich nicht wiederverwendet.

## Befehle und Umfang

| Befehl | Zweck |
|---|---|
| `npm run check` | ESLint und TypeScript |
| `npm test` | Bestehende Node-Tests sowie Unit-/Komponententests |
| `npm run test:watch` | Unit-/Komponententests beim Bearbeiten erneut ausführen |
| `npm run test:coverage` | Abdeckung der ausdrücklich aufgeführten Kernmodule prüfen |
| `npm run test:e2e` | API, Chromium und emulierte Mobilansicht |
| `npm run test:browsers` | Zusätzlich Firefox und WebKit |
| `npm run test:visual` | Screenshotvergleich in festgelegter Linux-Umgebung |
| `npm run test:visual:update` | Neue Referenzbilder erzeugen; Änderungen anschließend prüfen |
| `npm run test:report` | HTML-Bericht des letzten Playwright-Laufs öffnen |

Die Coverage-Grenzen gelten für Rollen, Login-Schema, Login-Hook und Loginformular;
sie sind **keine Aussage über die Abdeckung der gesamten Anwendung**. Bestehende
Node-Tests sichern zusätzlich HTTP-Validierung, Fehlerantworten, Passwortlogik,
Deployment und weitere Hilfsfunktionen ab. Bestehende Python-/Go- und
Infrastruktur-Integrationstests bleiben im Observability-Workflow.

Die Playwright-Tests prüfen echte Anmeldung inklusive CSRF, Logout, serverseitige
Seiten- und API-Berechtigungen, Sessionwiderruf, deaktivierte Konten,
Anmeldelimits und die migrierte PostgreSQL-Datenbank. axe prüft öffentliche Seiten
und den internen Bereich auf automatisierbare Barrierefreiheitsprobleme.
Tastaturbedienung und horizontales Überlaufen werden ebenfalls geprüft.
Die Mobilansicht ist eine Browseremulation und ersetzt keine Prüfung auf echten Geräten.

Beim Einrichten konnte die mitgelieferte Firefox-Version auf diesem Mac ihr
Profilverzeichnis nicht öffnen. Die zwölf Firefox-Tests wurden deshalb zusätzlich
unter Linux erfolgreich geprüft. `test:all` verwendet lokal Chromium und benötigt
Firefox nicht; der vollständige Browserlauf bleibt in der Linux-CI aktiviert.
Ein Fehler beim nativen Firefox-Start wird nicht durch übersprungene Tests verdeckt.

## Screenshotvergleiche

Die vier Referenzbilder für Homepage und Login in Desktop- und Mobilbreite liegen
unter `visual/snapshots/`. Lokale Läufe und CI verwenden dasselbe Playwright-Docker-
Image für `linux/arm64`, damit Betriebssystem, Schriften und Browser vergleichbar sind.
Auf Apple Silicon läuft diese Umgebung nativ; CI verwendet dafür `ubuntu-24.04-arm`.
Auf Intel-/AMD-Rechnern wird für diese Prüfung ein ARM64-Docker-Host benötigt;
Browser unter CPU-Emulation sind nicht zuverlässig.
Beim Aktualisieren von Playwright auch die Version in `Dockerfile.visual` anpassen.

Referenzbilder nur nach einer bewusst vorgenommenen UI-Änderung aktualisieren und
visuell prüfen. Fehlende Bilder und Bildabweichungen lassen den normalen Testlauf
fehlschlagen; CI erzeugt niemals automatisch neue Referenzen.

## Commit, Pull Request und Bereitstellung

Optionaler lokaler Commit-Hook:

```sh
git config --local core.hooksPath .githooks
```

Der Hook führt `check` und `test:unit` aus. Vollständige Browserläufe finden nicht
bei jedem Commit statt. Ein bestehender eigener Hook muss vor der Aktivierung
mit diesem Ablauf zusammengeführt werden.

Der Workflow `Anwendung testen` läuft bei Pull Requests, Pushes auf `main`, manuell
und nachts. Die Jobs `Anwendung prüfen` und `Ansichten vergleichen` sind die
vorgesehenen verpflichtenden Prüfungen. In den GitHub-Repository-Einstellungen
nach dem ersten erfolgreichen Lauf für `main` als erforderliche Statusprüfungen
aktivieren und direkte Änderungen ohne Pull Request einschränken. Diese
serverseitige Repository-Einstellung ist nicht Bestandteil einer Workflow-Datei.
Nachts und bei manuellem Start läuft zusätzlich die vollständige Browsermatrix.

Der Next.js-Build-/Deployment-Workflow hängt von erfolgreichen Anwendungstests
und dem Sicherheits-Audit ab. Die Tests prüfen denselben Git-Stand, bevor Images
gebaut werden. Nach einer Bereitstellung prüfen lesende Smoke-Tests Homepage,
Login, Weiterleitung und öffentliche Telemetrie-Konfiguration. Der bestehende
Swarm-Betrieb einschließlich `start-first` bleibt erhalten.

Eine Staging-Umgebung ist damit noch nicht eingerichtet. Der manuell ausführbare
Workflow `Bereitstellung prüfen` kann eine vorhandene Staging-Adresse prüfen.
Lokal funktioniert derselbe lesende Test so:

```sh
SMOKE_BASE_URL=https://staging.example.test npm run test:smoke
```

Smoke-Tests erstellen keine Konten und verändern keine Daten. Die vollständige
Suite mit Testkonten ausschließlich gegen die isolierte Testumgebung ausführen.
Nach Deployment prüfen Smoke-Tests Erreichbarkeit und öffentliche Abläufe, nicht
sämtliche angemeldeten Funktionen oder die ausgelieferte Image-Identität.

CI speichert HTML-/JUnit-Berichte, fehlgeschlagene Screenshots und Traces sowie
Coverage-Berichte sieben Tage. Traces enthalten Testeingaben und lokale Sessions;
als interne Entwicklungsartefakte behandeln. Fehlgeschlagene CI-Tests werden
höchstens einmal wiederholt; auch erst beim Wiederholen erfolgreiche Tests lassen
den CI-Lauf fehlschlagen und müssen korrigiert werden.

## Weitere Tests bei wachsendem Funktionsumfang

Neue Fachfunktionen erhalten Tests für ihre Geschäftsregeln, API-Berechtigungen
und zentrale Nutzerabläufe. Fehlerbehebungen bekommen passende Regressionstests.
Keine vollständige Wiederholung aller Validierungsvarianten im Browser.

Vor größeren Releases zusätzlich manuell mit Tastatur, Screenreader und echten
Mobilgeräten prüfen. Lasttests und vertiefte Sicherheitsprüfungen benötigen
vereinbarte Lastziele und eine geeignete Staging-Umgebung; sie gehören nicht in
die normalen Browsertests gegen Produktion.
