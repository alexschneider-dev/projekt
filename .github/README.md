# GitHub Actions

Workflow-Dateien liegen direkt unter `.github/workflows/`. GitHub unterstützt
dort keine Unterordner. Dateinamen und Anzeigenamen kennzeichnen die Zuständigkeit:

| Bereich | Workflows |
| --- | --- |
| Marketplace | `marketplace-tests.yml`, `marketplace-deploy.yml` |
| Stellensuche | `stellensuche-tests.yml`, `stellensuche-deploy.yml`, `stellensuche-smoke.yml` |
| Infrastruktur | `infrastructure-nginx.yml`, `infrastructure-observability.yml`, `infrastructure-stack.yml` |
| Gemeinsam verwendet | `shared-deploy-service.yml`, `shared-security-audit.yml` |

Anwendungsspezifische Tests und Skripte bleiben in `apps/marketplace/` beziehungsweise
`apps/stellensuche/`. Gemeinsame Deployment-Skripte liegen unter `production/`,
Infrastrukturwerkzeuge unter `infrastructure/`. Lokale Composite Actions liegen
unter `.github/actions/`.

Bei einer Umbenennung auch `uses`-Verweise, Pfadfilter, Dokumentation und
`apps/stellensuche/testing/production-workflows.test.mjs` aktualisieren.
