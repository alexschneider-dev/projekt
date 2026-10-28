# Gemeinsame npm-Verwaltung

Next.js liegt im Repository-Root; Node-Dienste sind npm Workspaces. Alle Installationen und Updates erfolgen im Root mit `npm install` beziehungsweise `npm ci`. Es gibt nur einen `package-lock.json`.

Next.js-Versionen stehen in den Root-`dependencies` und `devDependencies`. Root-`overrides` legen die Versionen für die Dienste fest: `$prisma`, `$@prisma/client` und `$dotenv` übernehmen die Versionen aus dem Root-Manifest. Auch die Prisma-Konfiguration im Root importiert `dotenv` direkt. Reine Service-Pakete können ihre Version direkt in `overrides` erhalten. Die Service-Manifeste nennen benötigte Pakete mit `*`. Der Migrationsdienst verwendet dadurch dieselbe Prisma-Version wie die Anwendung (derzeit 6.12.0).

Für neue Node-Dienste:

1. `services/NAME/package.json` mit eindeutigem Namen, `private: true` und den benötigten Paketen anlegen.
2. Den Pfad in den Root-`workspaces` aufnehmen und Paketversionen zentral ergänzen.
3. Das Manifest vor `npm ci` in allen Node-Dockerfiles kopieren; gegebenenfalls Compose-Watch um einen Rebuild-Eintrag ergänzen.
4. Im Root `npm install` ausführen und das gemeinsame Lockfile committen.

Dienst-Images installieren gezielt mit `npm ci --workspace services/NAME --include-workspace-root=false --omit=dev`. Docker verwendet das Repository-Root als Build-Kontext. Nginx und andere Dienste ohne Node.js benötigen kein npm-Workspace; ihre Image-Versionen bleiben in Dockerfiles beziehungsweise Compose.

## Sicherheitsprüfung

`npm run audit:dependencies` prüft das gemeinsame Lockfile einschließlich Entwicklungsabhängigkeiten. Ab Schweregrad `low` schlägt die Prüfung fehl; auch Registry- oder Netzwerkfehler blockieren den Build. `npm run build` und `npm run analyze` führen die Prüfung automatisch vorab aus.

Der Workflow `.github/workflows/security-audit.yml` prüft täglich um 06:23 UTC (07:23 Uhr im Berliner Winter, 08:23 Uhr im Sommer), bei Pull Requests mit Manifest-/Lockfile-Änderungen sowie auf manuellen Aufruf. Der Next.js-/Migrations-Workflow ruft ihn vor dem Build auf. Bei einem Fehler werden weder Images gebaut noch deployt. Der Audit-Bericht steht in der Actions-Zusammenfassung. Updates werden nicht automatisch installiert.

## E-Mail über GitHub Actions

E-Mail-Benachrichtigungen zu fehlgeschlagenen Workflow-Läufen erfolgen über GitHubs eigene Benachrichtigungsfunktion; SMTP-Secrets sind nicht erforderlich. Im persönlichen GitHub-Konto unter Settings → Notifications → System → Actions E-Mail-Benachrichtigungen aktivieren und bei Bedarf auf fehlgeschlagene Workflows beschränken. Die Zustellung hängt von den persönlichen GitHub-Benachrichtigungseinstellungen und der Teilnahme am Workflow ab; der geplante Workflow wird zunächst dem Benutzer zugeordnet, der den Zeitplan zuletzt geändert hat.

Geplante Läufe starten erst, wenn der Workflow auf dem Default-Branch liegt und Actions aktiviert ist. Nach dem Push den Audit-Workflow einmal manuell starten und die Benachrichtigungseinstellungen prüfen. Die Repository-Dateien allein aktivieren keine persönlichen E-Mail-Einstellungen.

GitHub-Dokumentation: [Benachrichtigungen für Workflow-Läufe](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).
