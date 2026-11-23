# Gemeinsamer Nginx

Der Proxy gehört zur Infrastruktur und bedient alle Anwendungen. Das Produktions-
Image wird aus diesem Ordner gebaut; `development/` enthält den lokalen HTTPS-Proxy.
Lokale Zertifikate bleiben ignoriert und werden nicht in das Produktions-Buildkontext übernommen.

- Aktuell `/` → statische Projektübersicht, `/marketplace` → Marketplace-HAProxy, `/stellensuche` → Stellensuche-HAProxy.
- `/grafana/` bleibt durch die Stellensuche und deren Super-Admin-Prüfung geschützt.
- Jede App besitzt zusätzlich einen eigenen Nginx mit eigenen Anmeldelimits.
- Die Anwendungsdienste und Metriken bleiben intern. Antworten mit Session-Daten
  werden nicht über einen gemeinsamen Proxy-Cache geteilt.

Build: `docker build -t nginx-projekt infrastructure/nginx` aus der Repository-Wurzel.
Der Workflow `infrastructure-nginx.yml` baut, prüft und veröffentlicht das Image
unabhängig von den Anwendungen. Betriebsparameter bleiben in `production/compose.swarm.yml`.

## Lokale Entwicklung

Eigene Compose-Datei: `development/compose.dev.yml`. Die optionale Datei
`development/.env.development.docker` enthält `NGINX_DEV_VERSION=1.00`.
Ohne Datei wird ebenfalls `1.00` verwendet. Die Vorlage liegt daneben.

Aus der Repository-Wurzel:

```bash
./infrastructure/nginx/development/start.sh
./infrastructure/nginx/development/stop.sh
```

Lokale TLS-Zertifikate müssen vorher im Entwicklungsordner liegen. Der Proxy
verwendet das gemeinsame Netzwerk `nextjs_dev` und startet keine Anwendungen. Nur der lokale Haupt-HAProxy veröffentlicht 80/443;
der Haupt-Nginx bleibt intern.
Fehlende Backends verhindern seinen Start nicht; deren Routen liefern bis zum
Anwendungsstart einen Gateway-Fehler.

Bei einem bereits laufenden Nginx aus dem alten Stellensuche-Compose-Projekt diesen
einmalig mit `docker stop nginx-projekt` und `docker rm nginx-projekt` entfernen,
bevor der neue Ablauf gestartet wird. Der alte Cache bleibt erhalten; der neue
Compose-Ablauf verwendet einen eigenen Cache. Keine Datenbankvolumes entfernen.

Die Projektübersicht liegt unter `landing/index.html` und zeigt nur den Marketplace.
Der Entwicklungsbuild verwendet `development/Dockerfile` mit `infrastructure/nginx`
als Kontext; ausschließlich dieser Build darf die lokalen Entwicklungszertifikate einbinden.

Grafana wird über `grafana.inc` ausschließlich durch den Marketplace autorisiert.
Nur dessen `SUPER_ADMIN` darf zugreifen; Gäste werden zu `/marketplace/login`
weitergeleitet. Browser-Identitätsheader werden durch das Ergebnis der serverseitigen
Prüfung ersetzt. Die Stellensuche-Session reicht nicht aus.

Der Entwicklungsproxy ordnet `/__nextjs_original-stack-frames` und die
Overlay-Schriften unter `/__nextjs_font/` anhand des Referers der jeweiligen App zu.
Diese Debug-Weiterleitungen existieren nicht in Produktion.
