# Projekt

Webanwendung zum Sammeln und Verwalten von Stellenanzeigen mit persönlichen
Benutzerbereichen, E-Mail-/Passwort-Login und rollenbasierten Zugriffsrechten.

- **Anwendung:** Next.js, React, TypeScript und Tailwind CSS.
- **Authentifizierung und Datenbank:** NextAuth, Prisma und PostgreSQL.
- **Betrieb:** Docker Swarm mit HAProxy, Nginx und Redis; automatisierte Bereitstellung über CI/CD.

Das Repository enthält Anwendung, wiederverwendbare UI-Komponenten, Tests und
Deployment-Konfiguration. Details zum Betrieb stehen in [production/README.md](production/README.md).

## Stellenverwaltung und Benutzer

Benutzer können Suchgruppen mit Titel und URL verwalten, Stellen automatisch oder
manuell importieren, markieren und per CSV mit vorhandenen Listen abgleichen.
Die Stellenliste bietet Filter, Seiten mit 100 Einträgen und einen Zähler für
Stellen mit Status `PENDING`.

Suchgruppen, Stellen, Stellenstatus und Importstatus gehören direkt zu einem
Benutzer (`userId`). Andere Benutzer sehen diese Daten nicht. Gleiche URLs sind
bei verschiedenen Benutzern erlaubt. Die Benutzer-ID stammt ausschließlich aus
der serverseitig geprüften Anmeldung. Ein separates Kundenmodell gibt es nicht.

- `USER`: alle Benutzerfunktionen innerhalb der eigenen Daten, eine Suchgruppe und höchstens 100 Stellen.
- `SUPER_ADMIN`: zusätzlich Grafana und Observability. Auch diese Rolle sieht
  in der Stellenverwaltung ausschließlich die eigenen Daten.

Der Importdienst verarbeitet aktive Benutzer und ihre Suchgruppen nacheinander.
Manuelle Anforderungen gelten nur für den angemeldeten Benutzer. Der automatische 24-Stunden-Durchlauf berücksichtigt alle aktiven Benutzer.

Details: [Stellenimport](scripts/jobs/README.md) und [Benutzerkonten](docs/auth.md).

## Einrichtung nach dem Klonen

- [Development auf dem Mac](docs/development-mac.md): Werkzeuge, lokale Env-Dateien,
  HTTPS-Zertifikate, Docker-Dienste, Migrationen und erstes Benutzerkonto.
- [Produktion auf einem neuen Server](docs/produktion-neuer-server.md): Voraussetzungen
  und Tokens, Servereinrichtung, alle Services, TLS, Monitoring, Backups und CI/CD.

Die Produktionsanleitung beschreibt eine Erstinstallation auf einem einzelnen
Ubuntu-Server. Für bestehende Installationen gelten die Betriebs- und
Umstellungshinweise in der Produktionsdokumentation.

## Installation als App (PWA)

Die Anwendung kann über HTTPS als App installiert werden. Unterstützende Browser
zeigen „App installieren“ an; alternativ erfolgt die Installation über das
Browsermenü. Auf iPhone und iPad zeigt „App installieren“ eine Anleitung direkt
auf der Website: „Teilen“, „Zum Home-Bildschirm“ und „Hinzufügen“. In der bereits
als App geöffneten Ansicht wird dieser Button ausgeblendet. Die App startet auf der öffentlichen Homepage; auch nach
dem Login bleibt die Homepage das Ziel.

Anmeldung und Datenzugriffe benötigen weiterhin eine Internetverbindung. Nach
dem ersten erfolgreichen Online-Aufruf im Produktionsbetrieb speichert der
Service Worker ausschließlich die öffentliche Offline-Hinweisseite und ihre
Styles. Bei einem fehlgeschlagenen Seitenaufruf erscheint „Keine Verbindung“;
„Erneut versuchen“ öffnet die Homepage. In einer bereits geöffneten Anwendung
erscheint bei gemeldetem Verbindungsverlust ein Hinweis mit einer Schaltfläche
zum Neuladen. API-Antworten und geschützte Seiten werden nicht im Service-Worker-Cache gespeichert.

Der Service Worker wird nur im Produktionsmodus registriert. Lokal lässt sich
seine Funktion mit einem Produktionsbuild auf localhost prüfen. Für Änderungen
an der Offline-Seite oder ihren Styles die Cache-Version in
`lib/pwa/service-worker.ts` erhöhen. App-Symbole liegen unter `public/icons/`;
`icon.svg` ist die gemeinsame Vorlage der PNG-Dateien.

## Observability

Ein separater Docker-Swarm-Stack mit 15 Diensten erfasst Metriken, Logs und Traces:
Grafana, Prometheus, Loki, Tempo, Alloy, Thanos und Exporter. Grafana nutzt die
bestehende Anmeldung und ist ausschließlich für berechtigte Administratoren zugänglich.

- Zugangsdaten werden über Docker Secrets bereitgestellt.
- S3-kompatibler Objektspeicher speichert die Monitoring-Daten; Grafana-Sicherungen werden täglich hochgeladen,
  zurückgelesen und per Prüfsumme geprüft.
- Dashboards und E-Mail-Alarme überwachen Anwendung, Container, RAM, Swap und Sicherungen.
- Ressourcenlimits berücksichtigen den 2-GB-Server; die Stabilität unter Last bleibt zu beobachten.
- Loki-Abbruchmeldungen, Grafana-Proxy-Verhalten und Login-Weiterleitungen wurden
  korrigiert und durch Integrationsprüfungen abgesichert.

Installation, Prüfungen und Betrieb: [Observability-Dokumentation](production/observability/README.md).

## PostgreSQL-Backups

PostgreSQL-Backups werden alle sechs Stunden automatisch im bestehenden S3-Log-Bucket
gespeichert und per Prüfsumme überprüft. Details zur Aufbewahrung und Wiederherstellung:
[Backup-Dokumentation](production/observability/README.md#postgresql-sicherungen).

## Tests

- **Vitest:** Unit- und Komponententests für Geschäftslogik und Formulare.
- **Playwright:** API- und Browsertests sowie Barrierefreiheitsprüfungen und Screenshotvergleiche.
- **Testdaten:** Separate PostgreSQL-Datenbank in Docker mit automatischen Migrationen und Testkonten.
- **Automatisierung:** Schnelle Prüfungen über einen lokalen Commit-Hook, Tests in GitHub Actions
  und Smoke-Tests nach der Bereitstellung.

Die lokale Anwendungstestsuite starten:

```sh
npm run test:all
```

Voraussetzungen, weitere Befehle und Testkonten: [Testanleitung](testing/README.md).

## Registrierung und Kontingente

Unter `/registrieren` können neue Benutzer ein Konto mit E-Mail und Passwort
anlegen. Der Versand erfolgt über die [Resend-API](https://resend.com/docs/api-reference/emails/send-email).
Erst die Bestätigung legt einen aktiven Benutzer mit Rolle `USER` an. Der Link
ist 24 Stunden gültig und nur einmal verwendbar. Ein erneuter Versand ersetzt
den alten Link. Abgelaufene Registrierungen müssen neu begonnen werden.
Vorhandene Konten und die administrative Kontoanlage bleiben nutzbar.

Reguläre Konten dürfen eine Suchgruppe und maximal 100 Stellen insgesamt speichern.
Deaktivierte Gruppen und Stellen mit jedem Status zählen mit. Die bestehende Suche kann
bearbeitet werden. API, CLI und Import prüfen die Grenzen serverseitig;
Datenbanksperren verhindern ein Überschreiten durch parallele Anfragen.
Bei vollem Kontingent pausiert der Abruf weiterer Stellen. Bestehende Daten werden
nicht gelöscht. `SUPER_ADMIN` ist von den Kontingenten ausgenommen und hat zusätzlich
Zugang zu Observability; jeder Benutzer sieht weiterhin nur seine eigenen Stellen.

Lokal benötigt die Anwendung neben ihren bestehenden Variablen:

```dotenv
RESEND_API_KEY=re_dein_schluessel
MAIL_FROM="Projekt <konto@deine-verifizierte-domain.de>"
NEXTAUTH_URL=http://localhost:3000
TRUST_PROXY=false
```

Diese Werte gehören in `.env.local`, nicht ins Repository. Für Prisma-Migrationen
muss `DATABASE_URL` in der Shell oder der von Prisma geladenen `.env` vorhanden sein.
Nach dem Update `npx prisma migrate deploy` und `npx prisma generate` ausführen.
Die Anwendung neu starten. Bei Resend muss die Absenderdomain freigegeben sein.
Ohne gültige Mailkonfiguration bleibt die Registrierung geschlossen; bestehende
Benutzer können sich weiterhin anmelden.

Registrierung und erneuter Versand teilen Datenbanklimits: drei Versuche pro
E-Mail-Adresse und zehn pro Quelle innerhalb einer Stunde, zusätzlich maximal
100 Versuche für die gesamte Anwendung. Bestätigungen sind auf 30 Versuche pro
Quelle und 500 insgesamt pro Stunde begrenzt. Abgewiesene Anfragen antworten mit
HTTP 429 und `Retry-After`. Ohne vertrauenswürdigen Proxy teilen Anfragen das
Quellenlimit. `TRUST_PROXY=true` nur setzen, wenn der vorgeschaltete Proxy
`X-Real-IP` überschreibt und Next.js nicht direkt aus dem Internet erreichbar ist.
Die mitgelieferte Produktions-Nginx-Konfiguration erfüllt dies; sie begrenzt
zusätzlich Anfragen vor der Anwendung.

Lokale Prüfungen ohne Versand echter E-Mails:

```sh
npm run test:db
npm run test:registration:db
npm run test:coverage
npm run test:e2e
```

Die Datenbanktests verwenden ausschließlich die isolierte Testdatenbank. Resend
wird dort simuliert; ein erfolgreicher Test bestätigt keinen echten Versand über
das Resend-Konto.

### Stellenstatus

Stellen verwenden das Prisma-Enum `JobStatus`: `PENDING` (Standard), `BEWORBEN`,
`NICHT_PASSEND` und `AUSGELAUFEN`. Der Status ist direkt in der Tabelle änderbar.
Der URL-Filter lautet beispielsweise `/stellen?status=BEWORBEN`; ohne Statusparameter
werden alle Stellen angezeigt. Ein Filterwechsel setzt die Seite auf 1 zurück.
Der Zähler oben zählt alle eigenen Stellen mit Status `PENDING`.

Der CSV-Abgleich setzt ausschließlich bereits vorhandene eigene Stellen auf
`BEWORBEN`, auch wenn sie zuvor als nicht passend oder ausgelaufen eingestuft waren.
Die Migration übernimmt bisher markierte Stellen als `BEWORBEN`, alle übrigen als
`PENDING`. Vor dem Start der neuen Anwendung `prisma migrate deploy` ausführen
und den Prisma-Client neu generieren.

### Prisma im lokalen Entwicklungsbetrieb

`npm run dev` generiert den Prisma-Client vor dem Start neu. Nach einer
Schemaänderung im laufenden Betrieb den Entwicklungsserver neu starten und
vorhandene Migrationen mit `npx prisma migrate deploy` anwenden.

Das lokale Startskript `services/development/scripts/start_local_services.sh`
baut die Images auch beim Start neu (mit Docker-Build-Cache) und wendet die
vorhandenen Migrationen in der lokalen Datenbank an. So werden Schemaänderungen,
die vor dem Start von Compose Watch entstanden sind, ebenfalls übernommen.
