# Marktplatz und Stellensuche gemeinsam betreiben

## Zielbild

Die Proxy-Kette ist für jede Anwendung getrennt:

```text
Browser → Haupt-HAProxy → Haupt-Nginx → / Projektübersicht
                          ├─ /marketplace  → Marketplace-HAProxy → Marketplace-Nginx → Marketplace
                          └─ /stellensuche → Stellensuche-HAProxy → Stellensuche-Nginx → Stellensuche
```

Der Haupt-Nginx enthält getrennte Routingdateien `marketplace.inc` und
`stellensuche.inc`. Jeder App-Nginx hat eigene Anmeldelimits und einen eigenen
Speicherbereich. `marketplace_login_limit_key` und `stellensuche_login_limit_key`
sind voneinander unabhängig. Die App-Proxys veröffentlichen keine Host-Ports.

Beide Anwendungen besitzen eigene Pakete, Images, Datenbankrollen und NextAuth-
Secrets. Marketplace verwendet `/marketplace/api/auth`, Stellensuche `/stellensuche/api/auth`.
Die Cookie-Namen tragen jeweils den App-Namen. Grafana prüft ausschließlich die
Marketplace-Session und die Rolle `SUPER_ADMIN` über
`/marketplace/api/observability/auth`. Stellensuche-Sitzungen gewähren keinen Zugang.
Die Marketplace-Session verwendet Cookie-Pfad `/`, damit sie auch unter `/grafana/`
ankommt. Der neue Name `marketplace.session-token.v2` erfordert einmaliges erneutes
Anmelden im Marketplace. CSRF- und Callback-Cookies bleiben auf die App begrenzt.
Beide Anwendungen liegen auf derselben Origin; dies ist keine Origin-Isolation
wie bei getrennten Subdomains.

Lokal: Projektübersicht unter `https://localhost`, Marketplace unter
`https://localhost/marketplace` und Stellensuche unter `https://localhost/stellensuche`.
Die Projektübersicht zeigt ausschließlich den Marketplace.
`NEXTAUTH_URL` lautet entsprechend `https://localhost/marketplace/api/auth` beziehungsweise
`https://localhost/stellensuche/api/auth`. Der Marketplace verwendet den basePath `/marketplace`,
die Stellensuche verwendet `/stellensuche`. Ihr Service Worker ist auf diesen
Pfad beschränkt. Der bisherige Root-Service-Worker wird beim Update abgemeldet.
Die bestehende Produktion wurde nicht umgestellt.

## Marktplatz vorbereiten

1. Mit `infrastructure/postgres/provision-app.sql` das Schema `marketplace` und
   `marketplace_app` in der vorhandenen Datenbank einrichten. Keine Admin-URL in
   den Anwendungscontainer übernehmen.
2. Eigene `DATABASE_URL`, `NEXTAUTH_SECRET` und Resend-Konfiguration setzen.
   `NEXTAUTH_URL=https://DEINE-DOMAIN/marketplace/api/auth`.
3. Image aus `apps/marketplace/Dockerfile` bauen. `NEXT_PUBLIC_BASE_PATH` ist ein
   Build-Argument, Standard `/marketplace`. Bei Änderung neu bauen.
4. Migrationen aus `apps/marketplace/prisma` über einen eigenen Migrationslauf
   ausführen. Die bestehenden Stellensuche-Pipelines erledigen das nicht.
5. Im vorhandenen geschützten Env-Verzeichnis eine `marketplace.env` ergänzen.
   `production/prepare-config.mjs` erzeugt daraus eigene versionierte Secrets und
   Runtime-Einbindungen. Ohne diese Datei bleibt der Marktplatz optional. Beim
   Erneuern einer bestehenden Marketplace-Konfiguration die Datei beibehalten.
6. Der Dienst `marketplace` ist bereits in `production/compose.swarm.yml` definiert:
   eine Replik, `start-first`, 512 MB Limit und 128 MB Reservierung. Das sind
   Startwerte, keine bestätigte Kapazitätsplanung für Millionen Produkte. Die
   Laufzeitdatei kann diese Betriebsparameter nicht überschreiben.
7. Nach Einrichtung des Schemas und der Secrets den Workflow
   `marketplace-deploy.yml` mit einer Version wie `1.00`
   starten. Er prüft zuerst, baut Web- und Migrationsimage, veröffentlicht beide
   und ruft bei aktiviertem `deploy` den gemeinsamen Deployment-Workflow auf.
   Dieser migriert ausschließlich das Marketplace-Schema vor dem App-Update.
8. Das gemeinsame Nginx-Image über `infrastructure-nginx.yml` neu bauen und bereitstellen,
   damit die neuen Routen erreichbar werden. Bei der Erstbereitstellung Nginx zuerst
   aktualisieren; der Marketplace-Smoke-Test kann erst nach beiden Updates bestehen.

Für die erste manuelle Bereitstellung auf dem Manager stehen nach Synchronisierung
und vorbereiteter Runtime dieselben Befehle zur Verfügung:

```bash
sudo /usr/local/lib/projekt-deploy/migrate.sh 1.00 marketplace
sudo /usr/local/lib/projekt-deploy/deploy.sh marketplace 1.00
```

Die vorhandene Stack-Bereitstellung nimmt den Marketplace nur auf, wenn
`runtime.json` eine `services.marketplace`-Konfiguration enthält. Vorher wird er
vor der Compose-Zusammenführung aus der Basis entfernt. Nach der ersten
Service-Bereitstellung übernimmt ein Stack-Update dessen laufendes Image. Die
bestehenden Installations- und Deployment-Sperren werden wiederverwendet. Es wurde
kein Workflow ausgelöst, kein Image veröffentlicht und kein Server kontaktiert.

Benötigte Runtime-Werte: `PORT=3001`, `HOSTNAME=0.0.0.0`, `NODE_ENV=production`,
`DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`,
`TRUST_PROXY=true` nur hinter einem vertrauenswürdigen Proxy. R2- und Pexels-Schlüssel
gehören ausschließlich zum separat ausgeführten Importwerkzeug, nicht in das Web-Image.

## Nginx-Routing

Die gemeinsame Konfiguration liegt unter `infrastructure/nginx/default.conf`,
für die lokale Entwicklung unter `infrastructure/nginx/development/`. Beide
behalten die App-Pfade beim Weiterleiten bei und leiten an den jeweiligen App-HAProxy weiter. Eine dynamisch aufgelöste Backend-
Adresse verhindert, dass der Nginx vor der Erstbereitstellung am fehlenden Dienst
scheitert. Der neue Pfad wird nicht mit Session-Daten anderer Anwendungen gecacht.

Port 3001 und Metrikport 9465 nur intern verbinden. Liveness/Readiness:
`/marketplace/api/health` prüft auch die Datenbank. Nginx erhält ein eigenes Image
und einen unabhängigen Workflow; er gehört nicht mehr zur Stellensuche.

## Observability

`OBSERVABILITY_ENABLED=true`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://observability_alloy:4318`,
`OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`, `OTEL_SERVICE_VERSION=<Image-Version>`
und `METRICS_PORT=9465` setzen. Der Dienst muss Alloy und PostgreSQL über das
bestehende private Netzwerk erreichen können.

Der Prometheus-Job `marketplace` ist über Swarm-DNS `tasks.projekt_marketplace`
vorbereitet. Solange der Dienst nicht existiert, entstehen keine Scrape-Ziele.
Alloy kann Containerlogs über die bestehende Docker-Erkennung erfassen. Traces
verwenden `service.name=marketplace`, JSON-Logs `service=marketplace`.

Geeignete Grafana-Abfragen für den neuen Dienst:

```promql
sum(rate(app_http_request_duration_seconds_count{service="marketplace"}[5m]))
histogram_quantile(0.95, sum by (le) (rate(app_http_request_duration_seconds_bucket{service="marketplace"}[5m])))
sum(rate(app_http_request_duration_seconds_count{service="marketplace",status_code=~"5.."}[5m]))
process_resident_memory_bytes{service="marketplace"}
```

Bestehende feste `nextjs`-Dashboards zeigen den Marktplatz nicht automatisch.
Für seine Bereitstellung eigene Panels/Filter ergänzen und Scrape, Traces und Logs
am tatsächlichen Dienst prüfen. Grafana bleibt geschützt; keine öffentliche
Weiterleitung auf Metriken oder Verwaltungsoberflächen einrichten.

## Kosten und Freigabe

Der Bildimport ist vorbereitet, aber ohne Pexels-/R2-Konfiguration nicht ausgeführt.
Ein eigener Bildbucket darf erst nach Prüfung des gesamten R2-Kontingents öffentlich
werden. Das lokale Speicherbudget verhindert weder kontoweite Überschreitungen noch
beliebig viele öffentliche Leseoperationen. Die Null-Euro-Vorgabe ist deshalb noch
keine verifizierte Betriebseigenschaft. Es wurden keine Cloud-Ressourcen angelegt.

## Entwicklungs- und Prüfablauf

Vom Repository-Hauptordner aus:

```bash
./apps/marketplace/services/development/scripts/start.sh
./apps/marketplace/services/development/scripts/stop.sh
```

Alternativ aus `apps/marketplace`:

```bash
npm run dev:services
npm run dev:stop
```

Jede Anwendung besitzt eine eigene `services/development/scripts/compose.dev.yml`.
Beide Anwendungen verwenden für die Entwicklung ausschließlich ihre eigene
`.env.local`. Die Vorlage liegt jeweils im Anwendungsordner als `.env.example`.
Diese eine Datei enthält die Image-Version (`MARKETPLACE_DEV_VERSION` beziehungsweise
`PROJEKT_DEV_VERSION`), `DATABASE_URL`, das Anwendungspasswort
(`MARKETPLACE_DATABASE_PASSWORD` beziehungsweise `STELLENSUCHE_DATABASE_PASSWORD`)
sowie Authentifizierung, E-Mail und Observability.

Compose liest diese Datei und setzt im Container die interne `DATABASE_URL`.
Die URL in `.env.local` gilt für Host-Werkzeuge; ihr Passwort muss dem separaten
Passwortwert in derselben Datei entsprechen. Next.js lädt die weiteren Einstellungen
aus der schreibgeschützt eingebundenen `.env.local`. Es gibt keine zusätzliche
Docker-Env-Datei pro Anwendung.
Nginx verwendet separat `NGINX_DEV_VERSION` aus
`infrastructure/nginx/development/.env.development.docker`.
Die Stellensuche-Datei enthält keinen Marketplace-Dienst.

Voraussetzung: Die gemeinsame PostgreSQL-Instanz wird separat über
`infrastructure/postgres/development/start.sh` gestartet. Deren eigene
`.env.development.docker` enthält `POSTGRES_PASSWORD`; Anwendungskonfigurationen
enthalten keinen Administratorzugang. Der Container `postgres-projekt` läuft im
externen Docker-Netzwerk `nextjs_dev`. Schema `marketplace` und Benutzer
`marketplace_app` müssen einmalig mit `infrastructure/postgres/provision-app.sql`
eingerichtet sein. `MARKETPLACE_DATABASE_PASSWORD` in der Marketplace-`.env.local`
muss dem dabei vergebenen Passwort entsprechen (mindestens 24 URL-sichere Zeichen).
Der Start liest keine Stellensuche-Konfiguration und startet oder verändert deren
Container nicht. Gemeinsame Datenbank und Netzwerk werden nicht durch den
Marketplace-Stop entfernt.

Compose Watch synchronisiert Code und baut bei Paket-, Prisma- oder Dockerfile-
Änderungen neu. Migrationen laufen vor dem Entwicklungsserver; sie setzen den
bereits eingerichteten Datenbankbenutzer voraus.

`marketplace-tests.yml` prüft Pull Requests und Änderungen auf `main` mit einer
wegwerfbaren PostgreSQL-Instanz: Audit, Migrationen, wiederholter Seed, statische
Prüfungen, Unit-/DB-/Bildtests, Produktionsbuild, Desktop/Mobil mit Playwright,
Barrierefreiheit und HTTP-Login/Rollen. Fehlerbilder und Berichte bleiben sieben
Tage als GitHub-Artefakte verfügbar. Produktive Secrets werden nicht für Tests benötigt.

Der vorhandene tägliche Sicherheitsworkflow prüft beide Paketdateien. Der Nginx-
Release prüft sein gebautes Image vor der Veröffentlichung. Automatisierte Deployments
bleiben über das vorhandene GitHub-Environment `Production` und eine gemeinsame
Concurrency-Gruppe serialisiert. Für diese GitHub-Abläufe werden vorhandene Secrets
verwendet; ein lokaler SSH-Zugriff durch den Entwicklungsassistenten ist nicht nötig.

## Lokal verifizierter Stand

Am 19. November 2026 gegen eine isolierte PostgreSQL-17-Datenbank in Docker geprüft:

- Marketplace-Produktionsimage, Migrationsimage und Entwicklungsimage gebaut und
  gestartet; gemeinsame Nginx-Images für Entwicklung und Produktion gebaut.
- Migration und zweimaliger Seed mit 120 Produkten; sieben Unit-/Datenbanktests,
  zwei Bildtests und ein HTTP-Test für Anmeldung, Rollen und Cookie-Pfade bestanden.
- Vier Playwright-Tests für Desktop/Mobil einschließlich Barrierefreiheit bestanden.
- Lint, TypeScript, beide Abhängigkeitsprüfungen und 40 bestehende Tests für
  Produktionskonfiguration, Installer und Workflows bestanden.
- Homepage, Produkt-API, Anmeldung und Healthcheck hinter echtem HTTPS-Nginx geprüft;
  vorhandene Grafana-Tests für Zeitlimits und Abbrüche bestanden.

Die lokalen Images wurden auf ARM64 gebaut. Die GitHub-Pipeline baut für AMD64;
GitHub Actions selbst wurde noch nicht gestartet. Compose Watch an der vorhandenen
Entwicklungsdatenbank und ein produktiver Swarm-Rollout wurden nicht ausgeführt.
Bilderimport, E-Mail-Versand, kontoweite R2-Kosten und Lasttests mit Millionen
Produkten benötigen weiterhin die entsprechende Konfiguration und eigene Messungen.

## Proxy-Images und Releases

Die App-Proxys liegen jeweils unter `apps/APP/services/nginx/` und
`apps/APP/services/haproxy/`. Die jeweilige Entwicklungs-Compose-Datei startet
alle drei Dienste. Der gemeinsame Einstieg liegt unter `infrastructure/nginx/`;
lokal enthält dessen Compose-Datei auch den Haupt-HAProxy. In Produktion bleibt
`production/compose.edge.yml` für den Haupt-HAProxy zuständig.

Die App-Release-Workflows bauen zusätzlich die eigenen Nginx-/HAProxy-Images mit
derselben Release-Version. `deploy.sh nextjs VERSION` beziehungsweise
`deploy.sh marketplace VERSION` aktualisiert die App samt ihren Proxys. Betriebs-
parameter stammen weiterhin aus `production/compose.swarm.yml`.
Vor dem Umstieg die produktiven NextAuth-URLs für beide Apps ändern, beide Apps
neu bauen, die App-Proxys bereitstellen und danach das Haupt-Nginx-Routing umstellen.
Das ist eine koordinierte Routenmigration; vorhandene Stellensuche-Sessions werden
durch die neuen Cookie-Namen nicht übernommen. Keine automatische Produktionseinrichtung.

## Prüfung der endgültigen Proxy-Aufteilung

Lokal am 19. November 2026 mit isolierten Datenbanken geprüft: beide Anmeldungen im
selben Browser über Haupt-HAProxy, Haupt-Nginx und die jeweils eigenen App-Proxys.
Marketplace-Abmeldung lässt die Stellensuche-Session bestehen. Ein ausgelöstes
Marketplace-Loginlimit blockiert die Stellensuche nicht. Die Hauptseite zeigt nur
den Marketplace-Link; Desktop- und Mobilansicht sowie die Weiterleitung nach
`/marketplace` sind geprüft. Der Marketplace-Cookie gilt auch auf dem exakten
Basispfad ohne abschließenden Slash. Produktionsdeployment wurde nicht ausgeführt.
