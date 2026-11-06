# Projekt

Grundgerüst einer Webanwendung mit öffentlicher Startseite, E-Mail-/Passwort-Login
und geschützten Bereichen mit rollenbasierten Zugriffsrechten.

- **Anwendung:** Next.js, React, TypeScript und Tailwind CSS.
- **Authentifizierung und Datenbank:** NextAuth, Prisma und PostgreSQL.
- **Betrieb:** Docker Swarm mit HAProxy, Nginx und Redis; automatisierte Bereitstellung über CI/CD.

Das Repository enthält Anwendung, wiederverwendbare UI-Komponenten, Tests und
Deployment-Konfiguration. Details zum Betrieb stehen in [production/README.md](production/README.md).

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
Browsermenü. Auf iPhone und iPad in Safari „Teilen“ und anschließend „Zum
Home-Bildschirm“ wählen. Die App startet auf der öffentlichen Homepage; auch nach
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
