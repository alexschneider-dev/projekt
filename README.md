# Projekt

Grundgerüst einer Webanwendung mit öffentlicher Startseite, E-Mail-/Passwort-Login
und geschützten Bereichen für die Rollen `USER`, `ADMIN` und `SUPER_ADMIN`.

- **Anwendung:** Next.js, React, TypeScript und Tailwind CSS.
- **Authentifizierung und Datenbank:** NextAuth, Prisma und PostgreSQL.
- **Betrieb:** Docker Swarm mit HAProxy, Nginx und Redis; Bereitstellung über GitHub Actions.

Das Repository enthält Anwendung, wiederverwendbare UI-Komponenten, Tests und
Deployment-Konfiguration. Details zum Betrieb stehen in [production/README.md](production/README.md).
