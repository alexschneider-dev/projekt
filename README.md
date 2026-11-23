# Projekt – Anwendungen und Infrastruktur

Dieses Monorepo enthält eigenständige Anwendungen und die gemeinsam genutzte
Infrastruktur. Alle Bereiche werden in einem Git-Repository versioniert.

```text
apps/
  stellensuche/             Next.js, Prisma, Importdienst, Tests und Docker-Builds
  marketplace/              Stuhlkatalog, Verkäuferangebote, Bildimport und eigene Anmeldung
infrastructure/
  nginx/                   Gemeinsamer Proxy für die Anwendungen
  postgres/                Schema-Trennung in einer gemeinsamen Datenbank
  observability/           Grafana, Prometheus, Loki, Tempo, Alloy und Sicherungen
    loki-image/            Quellcode des angepassten Loki-Images
production/                Zentrale Bereitstellung und Betriebsparameter
docs/                     Übergreifende Entwicklungs- und Betriebsanleitungen
```

## Stellensuche entwickeln

Voraussetzung ist Node.js 22 gemäß `apps/stellensuche/package.json`.
Vom Repository-Hauptordner aus:

```bash
npm run setup:stellensuche
npm run dev:stellensuche
```

`setup:stellensuche` installiert die festgelegten Abhängigkeiten der Stellensuche. Die lokale
`.env.local` liegt in `apps/stellensuche`. Alternativ direkt dort arbeiten:

```bash
cd apps/stellensuche
npm ci
npm run dev
```

Die Befehle `npm run check` und `npm test` prüfen beide Apps; `npm run build`
baut standardmäßig den Marketplace. App-spezifische Befehle tragen den App-Namen. Der Hauptordner
selbst benötigt keine installierten Node-Abhängigkeiten. Bei direkten Aufrufen
von Werkzeugen wie `npx prisma` oder `npx playwright` zuerst in den
Anwendungsordner wechseln.

- [Funktionen und Anwendungskonfiguration](apps/stellensuche/README.md)
- [Lokale Entwicklung mit Docker](docs/development-mac.md)
- [Testabläufe](apps/stellensuche/testing/README.md)
- [Produktionsbetrieb](production/README.md)

## Gemeinsame Observability

Der Stack liegt unabhängig vom Anwendungscode in
[infrastructure/observability](infrastructure/observability/README.md).
Seine Node-Tests lassen sich mit `npm run test:observability` ausführen.
Docker-Builds und CI verwenden die neuen Quellpfade; bestehende Dienstnamen,
Volumes, Secrets und Backup-Präfixe bleiben erhalten.

Die vorhandenen Dashboards, Datenbank-Sicherungen und Grafana-Zugriffskontrollen
sind weiterhin für die Stellensuche konfiguriert. Insbesondere erfolgt der
Grafana-Zugang weiterhin über deren Anmeldung. Die Ordnertrennung ersetzt diese
Anbindung nicht automatisch durch eine zentrale Anmeldung.

Weitere Anwendungen können denselben Stack nutzen. Für jede Anwendung einen
eigenen Telemetrie-Dienstnamen, passende Metrikziele und eigene Dashboard-Filter
konfigurieren. Schemas und Zugangsdaten getrennt zuordnen. Die gemeinsame PostgreSQL-Datenbank
bleibt bestehen; die Sicherung umfasst alle Schemas.

## Gemeinsame Datenbank

Jede Anwendung erhält ein eigenes PostgreSQL-Schema und einen eigenen
Datenbankbenutzer innerhalb derselben Datenbank. Die Stellensuche verwendet
`stellensuche` und `stellensuche_app`. Einrichtung, Bestandsumzug und Prüfung
sind in [der Datenbankanleitung](infrastructure/postgres/README.md) beschrieben.
Der Bestandsumzug auf dem Server ist ein gesonderter manueller Wartungsschritt.

## Weitere Anwendung hinzufügen

Eine neue Anwendung erhält einen eigenen Ordner unter `apps/`, beispielsweise
`apps/verwaltung`, mit eigener `package.json`, Lockdatei, Konfiguration, Tests
und Dockerfile. Das kann auch eine NestJS-Anwendung sein. Installation und Builds
werden im jeweiligen Anwendungsordner ausgeführt; es gibt bewusst keinen
übergreifenden npm-Workspace und keine gemeinsame Abhängigkeitsauflösung.

Gemeinsame Bibliotheken erst bei tatsächlichem Bedarf unter `packages/` ergänzen.
Die anwendungsspezifischen Komponenten und Datenmodelle bleiben in ihrer Anwendung.

`production/compose.swarm.yml` bleibt die maßgebliche Quelle für die Betriebsparameter
der bestehenden Bereitstellung. Der Monitoring-Stack hat seine eigene
`infrastructure/observability/compose.swarm.yml`. Neue Anwendungen erhalten eigene
Dienste und Build-/Deployment-Abläufe. Die Anwendungen erhalten getrennte Release-Workflows. Der Marketplace verwendet
`marketplace-deploy.yml`; der gemeinsame Nginx wird unabhängig
über `infrastructure-nginx.yml` bereitgestellt.

## Marktplatz

Die neue Anwendung liegt unter [apps/marketplace](apps/marketplace/README.md).
Sie verwendet eigene Pakete, das Schema `marketplace` und standardmäßig den
URL-Pfad `/marketplace`. Die Root-Befehle `dev`, `build` und `start` wählen den Marketplace.
Die Stellensuche ist über `/stellensuche` erreichbar. [Betriebsintegration und URL-Aufteilung](docs/marketplace-betrieb.md).

### Anwendungen vom Repository-Hauptordner aus

Jede Anwendung hat ihre eigene `package.json` und Lockdatei. `npm run dev`,
`npm run build` und `npm start` wählen den Marketplace. Für eine explizite Auswahl:
`npm run dev:marketplace` oder `npm run dev:stellensuche`; entsprechend gibt es
`build:APP`, `start:APP`, `check:APP` und `test:APP`.
`npm run check` und `npm test` prüfen beide Anwendungen. Die vollständigen lokalen
Proxy-Ketten werden mit den jeweiligen Docker-Startskripten gestartet.
