# Projekt

Grundgerüst einer Webanwendung mit öffentlicher Startseite, E-Mail-/Passwort-Login
und geschützten Bereichen mit rollenbasierten Zugriffsrechten.

- **Anwendung:** Next.js, React, TypeScript und Tailwind CSS.
- **Authentifizierung und Datenbank:** NextAuth, Prisma und PostgreSQL.
- **Betrieb:** Docker Swarm mit HAProxy, Nginx und Redis; automatisierte Bereitstellung über CI/CD.

Das Repository enthält Anwendung, wiederverwendbare UI-Komponenten, Tests und
Deployment-Konfiguration. Details zum Betrieb stehen in [production/README.md](production/README.md).

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
