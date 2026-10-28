# Produktion: CI/CD und Swarm Secrets

## Nginx hinter HAProxy

Der separate Stack `projekt-edge` übernimmt die öffentlichen Ports 80 und 443.
HAProxy leitet TCP-Verbindungen mit PROXY-Protokoll v2 an Nginx auf 8081/8443
weiter. TLS und Zertifikate bleiben bei Nginx. Nur HAProxy und Nginx gehören in
das externe Overlay-Netzwerk `projekt_frontend` (10.253.0.0/24). Nginx vertraut
Client-Adressen ausschließlich aus diesem Netz und ersetzt eingehende
`X-Forwarded-For`-Werte vor der Weiterleitung an Next.js.

Nginx veröffentlicht selbst keine Host-Ports mehr. Dadurch können neue Tasks
vor dem Stoppen der alten starten. SIGQUIT und 140 Sekunden Stop-Frist geben
laufenden Anfragen Zeit zum Abschluss; Worker warten höchstens 120 Sekunden.
HAProxy verwaltet bis zu vier Nginx-Tasks, einschließlich überlappender Updates.
Die Platzierung auf einem Manager setzt derzeit einen einzelnen vorgesehenen
Ingress-Manager voraus. HAProxy selbst hat eine Replik und ist kein redundanter
Einstiegspunkt. Sein eigener Neustart kann Verbindungen unterbrechen.

Limits gelten pro Client-IP und Nginx-Instanz; mehrere Repliken teilen ihre Zähler
nicht. `burst` bezeichnet zusätzlich erlaubte Spitzen; alle Limits lehnen
Überschreitungen mit HTTP 429 ab, ohne Anfragen künstlich zu verzögern.

| Anfragen | Rate | Burst |
| --- | --- | --- |
| Seiten | 50/s, gemeinsame Zone mit API | 300 |
| API und übrige Next.js-Anfragen | 50/s, gemeinsame Zone mit Seiten | 50 |
| Passwort-Anmeldung (`POST /api/auth/callback/credentials`) | zusätzlich 1/s | 2 |
| Optimierte Bilder | 50/s, eigene Zone | 150 |
| Statische JS-, CSS- und WOFF2-Dateien | 100/s, eigene Zone | 300 |

Session-Abfragen erhalten kein zusätzliches Login-Limit. Anwendungsseitiger
Anmeldeschutz bleibt weiterhin erforderlich. Die Nginx-Bereitschaftsprüfung
verwendet lokal `/health` auf Port 8080 und prüft nicht die Next.js-Verfügbarkeit.

### Einmalige Umstellung des Eingangs

Vor weiteren Deployments ein Wartungsfenster einplanen und den bisherigen
Nginx-Image-Digest sowie die Service-Spezifikation sichern. Die Umstellung
verursacht eine kurze Unterbrechung zwischen Freigabe und Übernahme der Ports.

1. Prüfen, dass 10.253.0.0/24 nicht mit vorhandenen Netzen kollidiert. Bei einer
   Änderung sowohl das Netzwerk als auch `set_real_ip_from` anpassen.
2. Auf dem Manager `sudo docker network create --driver overlay --subnet
   10.253.0.0/24 projekt_frontend` ausführen. Ein bereits vorhandenes Netz zuvor
   mit `docker network inspect projekt_frontend` auf Typ und Subnetz prüfen.
3. Das neue Nginx-Image bauen und über den Nginx-Workflow bereitstellen. Dieser
   Schritt übernimmt auch die neue Service-Konfiguration ohne öffentliche Ports.
   Den gesamten Stack nicht zuvor mit dem alten Nginx-Image bereitstellen:
   Diesem fehlen die neuen Listener und der Healthcheck.
4. Aus einem Checkout dieses Commits im Ordner `production` den separaten Eingang
   starten: `sudo docker stack deploy -c compose.edge.yml projekt-edge`.
5. `sudo docker stack services projekt-edge`, `sudo docker service ps
   projekt_nginx`, HTTPS, HTTP-Weiterleitung, Login und Client-IP im Nginx-Log
   prüfen. Zertifikatsprüfungen über `/.well-known/acme-challenge/` bleiben möglich.

Für einen Rollback zuerst `sudo docker stack rm projekt-edge` ausführen und
warten, bis seine Tasks die Ports freigegeben haben. Anschließend
`sudo docker service rollback projekt_nginx` ausführen, solange die vorherige
Service-Spezifikation mit veröffentlichten Ports noch vorliegt.

Spätere Nginx-Releases verwenden weiterhin den bestehenden Workflow. Änderungen
an HAProxy werden separat aus `production` mit `compose.edge.yml` bereitgestellt;
sie werden nicht vom bestehenden CI-Installer übertragen. Bei Änderungen an
`edge-haproxy.cfg` den Config-Namen `projekt_edge_haproxy_v1` versionieren, da
Swarm Configs unveränderlich sind. Das Image ist per Digest fixiert; für einen
Versionswechsel `EDGE_IMAGE` beim Edge-Deploy setzen und den Digest dokumentieren.

Technische Grundlagen: [Nginx PROXY-Protokoll](https://docs.nginx.com/nginx/admin-guide/load-balancer/using-proxy-protocol/),
[Nginx-Anfragelimits](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html)
und [HAProxy PROXY-Protokoll](https://www.haproxy.com/documentation/haproxy-configuration-tutorials/proxying-essentials/client-ip-preservation/enable-proxy-protocol/).

## Bestehender Anwendungs-Stack

Next.js und Nginx verwenden einen gemeinsamen Deploy-Workflow. Jeder Lauf
überträgt `compose.swarm.yml` und die Deploy-Scripte vom ausgewählten Commit.
Der Service-Deploy übernimmt Image, Replicas, Limits, Healthchecks und
Secret-Zuweisungen ausschließlich für den ausgewählten Service, auch bei
gleicher Image-Version. Er verwendet kein `--prune`.

Mit `deploy=false` bauen die beiden Build-Workflows nur Images. Der zusätzliche
Workflow **Stack-Konfiguration für Produktion bereitstellen** übernimmt den gesamten Stack
und behält die aktuell laufenden Images aller vier Dienste einschließlich
Digests bei. PostgreSQL und Redis bekommen keinen eigenen Build-Workflow.
Alle Deploy-Jobs teilen eine Concurrency-Gruppe; Builds dürfen parallel laufen.
GitHub kann ältere wartende Runs ersetzen; das ist keine FIFO-Warteschlange.

Die Produktionsumgebung verwendet `/etc/projekt/runtime.json` für öffentliche Einstellungen
und Swarm-Secret-Verweise. Das gemountete Startscript lädt Secret-Inhalte aus
`/run/secrets/runtime_*` als Prozessvariablen. Sie stehen dadurch nicht mehr im
Klartext in der aktuellen Docker-Service-Spezifikation. Lokale Entwicklungs-Env-
Dateien bleiben bestehen. Unbekannte Variablen werden standardmäßig Secrets;
die öffentliche Allowlist steht in `public-keys.json`.

## Einmalige Umstellung eines bestehenden Servers

Diese Schritte benötigen den bestehenden Stack `projekt` mit `nextjs`, `nginx`,
`postgres` und `redis`. Sie sind keine Anleitung zur Erstinstallation.
Die Repository-Änderungen allein stellen den Server noch nicht um.

### 1. Deployment-Pause und Vorbereitung

Änderungen reviewen, committen und pushen. Vor der ersten Ausführung eines neuen
Deploy-Workflows die folgenden Schritte abschließen. Einen vertrauenswürdigen
Checkout dieses Commits auf dem Swarm-Manager bereitstellen; alle relativen
Befehle unten werden dort ausgeführt.

Bisherige Deploy-Scripte, YAML und Env-Dateien geschützt sichern und ein aktuelles
Datenbank-Backup erstellen. Es gibt hier keinen
automatischen Backup-Service vor einer Migration. Die erste Stack-Umstellung
startet Next.js und PostgreSQL neu; dafür ein Wartungsfenster einplanen.

Voraussetzungen auf dem Manager:

```sh
node --version
command -v flock
sudo docker info --format '{{.Swarm.ControlAvailable}}'
sudo docker stack services projekt
```

Benötigt werden Node.js mit `util.parseEnv` (20.12+ oder 22+), `flock`, ein
Swarm-Manager (`true`) und alle vier Services. Die bestehenden externen Volumes
und das Netzwerk `projekt_net` werden weiterverwendet. Root benötigt weiterhin
Zugriff auf die privaten GHCR-Images über die vorhandene Docker-Anmeldung.

### 2. Installer und Berechtigungen installieren

```sh
sudo install -d -o root -g root -m 0755 /usr/local/lib/projekt-deploy
sudo install -d -o root -g root -m 0700 /etc/projekt
sudo install -o root -g root -m 0755 \
  production/install-release.sh production/deploy.sh \
  production/deploy-stack.sh production/migrate.sh \
  /usr/local/lib/projekt-deploy/
sudo install -o root -g root -m 0644 production/compose.swarm.yml /usr/local/lib/projekt-deploy/
sudo visudo -f /etc/sudoers.d/projekt-deploy
```

Regeln aus `sudoers.example` übernehmen und `alex` durch den tatsächlichen
Deploy-Benutzer ersetzen. Bestehende benötigte Regeln erhalten. Danach:

```sh
sudo visudo -c
```

CI aktualisiert nur die im Installer aufgeführten Dateien, nicht den Installer
selbst. Der Deploy-Benutzer darf Root-Code aus dem Repository installieren und
ist deshalb ein vertrauenswürdiger Administrator der Produktionsumgebung.

Im bestehenden GitHub Environment **Production** werden weiterhin diese Secrets
verwendet: `PROD_HOST`, `PROD_USER`, `PROD_SSH_KEY`, `PROD_KNOWN_HOSTS`.
Builds verwenden `GITHUB_TOKEN` zur Anmeldung bei GHCR.

### 3. Env-Dateien in Secrets überführen

Den Pfad auf den tatsächlichen bisherigen Produktions-Env-Ordner setzen. Benötigt
werden `nextjs.env` mit `DATABASE_URL` und `postgres.env` mit `POSTGRES_PASSWORD`.
Bestehende Zugangsdaten unverändert übernehmen; keine neuen Passwörter erfinden.

```sh
PROD_ENV_DIR=/usr/local/lib/projekt-deploy/env
sudo node production/prepare-config.mjs "$PROD_ENV_DIR" /etc/projekt/runtime.json r1
```

Diese Vorschau zeigt nur Variablennamen und erstellt nichts. Öffentliche Werte
gegen `public-keys.json` prüfen. URLs dürfen keine Zugangsdaten enthalten;
`NEXT_PUBLIC_*` darf niemals geheim sein. Browser-Bundle-Werte werden gegebenenfalls
bereits beim Next.js-Build benötigt und lassen sich nicht durch Runtime-Secrets ersetzen.

Nach Prüfung:

```sh
sudo node production/prepare-config.mjs "$PROD_ENV_DIR" /etc/projekt/runtime.json r1 --apply
sudo docker secret ls
sudo docker config ls
```

Das erstellt versionierte Swarm Secrets, eine Docker Config für das Startscript
und die Manifest-Datei mit Modus `0600`. Die ursprünglichen Env-Dateien bleiben
erhalten. Ein bestehendes Manifest wird nicht überschrieben. Bei einem Fehler
keine leere/unvollständige Datei deployen; teilweise erzeugte Ressourcen prüfen
und für einen erneuten Versuch eine neue Revision sowie einen neuen Ausgabepfad
verwenden. Erst das vollständig geprüfte Manifest an den vorgesehenen Pfad setzen.

### 4. Stack einmalig umstellen und prüfen

Vorher Replicas, Limits und andere bisher nur auf dem Server geänderte Einstellungen
mit der Repository-YAML abgleichen. Der Stack-Deploy bewahrt Images, nicht manuelle
Konfigurationsabweichungen.

Den GitHub-Workflow **Stack-Konfiguration für Produktion bereitstellen** mit diesem Commit
starten oder alternativ auf dem vorbereiteten Manager ausführen:

```sh
sudo /usr/local/lib/projekt-deploy/deploy-stack.sh
sudo docker stack services projekt
sudo docker stack ps --no-trunc projekt
sudo docker service inspect projekt_nextjs --format '{{range .Spec.TaskTemplate.ContainerSpec.Secrets}}{{println .File.Name}}{{end}}'
curl --fail --silent --show-error https://alex-schneider-dev.de/ >/dev/null
```

Anwendung und Datenbankzugriff prüfen. Anschließend einen regulären Next.js-Release
mit neuer Version starten. Die Migration läuft als kurzlebiger Swarm-Service und
bekommt nur das Datenbank-Secret und das Startscript; sie benötigt keinen lokalen
Next.js-Container und liest kein Passwort mit `docker exec printenv` aus.

Bei Problemen kann `sudo docker service rollback projekt_SERVICE` die vorherige
Service-Spezifikation wiederherstellen, solange sie noch vorliegt. Das ist kein
Datenbank-Rollback. Alte Specs können noch Klartext-Env-Werte enthalten.

Alte Produktions-Env-Dateien und `versions.env` erst nach erfolgreicher Prüfung
und Ende des benötigten Rollback-Zeitraums entfernen. Zugangsdaten sicher extern
aufbewahren: Swarm bietet keinen normalen Export der Secret-Inhalte.

## Änderungen im Alltag

- Neue Version: jeweiligen Build-and-deploy-Workflow starten.
- Replicas/Limits: YAML ändern und betroffenen Service deployen. Bei gleicher
  Version kann nach Synchronisation der Dateien auch `deploy.sh SERVICE VERSION`
  verwendet werden. Manuelles `docker service scale` wird dabei durch YAML ersetzt.
- Gesamter Stack: Stack-Konfigurations-Workflow starten.
- Öffentliche Runtime-Werte: `sudoedit /etc/projekt/runtime.json`, anschließend
  betroffenen Service oder Stack deployen. Literale Dollarzeichen als `$$` schreiben.
- Secret hinzufügen/rotieren: neues versioniertes Swarm Secret erstellen,
  unter `secrets` im Manifest referenzieren und unter `services.SERVICE.secrets`
  mit `target: runtime_VARIABLE` zuweisen. Anschließend Service/Stack deployen.
  Alte Secrets bis zum Ende des Rollback-Zeitraums behalten. Ein neues
  `POSTGRES_PASSWORD` ändert nicht automatisch das Passwort einer vorhandenen DB-Rolle.

## Lokale Prüfung

```sh
node --test testing/production-*.test.mjs
npm run check
```

Die Tests simulieren Docker-Mutationen und rendern die Konfiguration mit dem echten
Docker CLI ohne Daemon. Ein tatsächlicher Swarm-Rollout wird damit nicht durchgeführt.
