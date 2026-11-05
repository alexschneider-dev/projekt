# Produktion: Erstinstallation auf einem neuen Server

Diese Anleitung richtet einen **leeren Ubuntu-24.04-LTS-Server mit x86-64,
systemd und einem einzelnen Docker-Swarm-Manager** ein. Die bestehenden CI-Builds
erzeugen `linux/amd64`-Images. Für ARM oder mehrere Nodes müssen Image-Builds,
Platzierung, Zertifikate und persistenter Speicher gesondert angepasst werden.

Das Ergebnis umfasst vier Anwendungsdienste (Next.js, PostgreSQL, Redis, Nginx),
HAProxy im Edge-Stack und 15 Monitoring-Dienste: Grafana, Prometheus, Loki, Tempo,
Alloy, node_exporter, cAdvisor, PostgreSQL-/Redis-/Nginx-/Swarm-Exporter und vier
Thanos-Dienste. Migrationen und S3-Sicherungen laufen zusätzlich zeitweise.
S3 und SMTP sind externe Dienste; Elasticsearch ist nicht Bestandteil des Projekts.

Dies ist eine Neuinstallation mit leerer Datenbank. Ein Umzug bestehender Daten
benötigt zusätzlich einen geprüften Restore vor der Freigabe. Die Befehle werden
hier dokumentiert, nicht automatisch auf einem Server ausgeführt.

## 1. Voraussetzungen und Zugangsdaten sammeln

| Voraussetzung | Wofür / Ablage |
| --- | --- |
| Server-IP, SSH-Zugang und sudo | Einrichtung und Deployment; SSH-Port 22 wird von CI vorausgesetzt. |
| Git-Repository mit GitHub Actions | Leseberechtigung zum Klonen; für ein privates Repository etwa ein separater SSH-Deploy-Key mit Leserecht. |
| GHCR-Zugang | Für private Images ein Personal Access Token **classic** mit `read:packages`, Paketberechtigung und gegebenenfalls SSO-Freigabe. |
| GitHub-Build-Berechtigung | Actions verwendet `GITHUB_TOKEN` mit `packages:write`; Paket-/Organisationsrichtlinien müssen das erlauben. |
| Domain und DNS-Verwaltung | Hauptdomain und `www` zeigen auf den Server; vorhandene AAAA-Einträge müssen ebenfalls stimmen. |
| E-Mail für Zertifikate | Registrierung bei Let's Encrypt. Für HTTP-01 ist kein DNS-API-Token erforderlich. |
| Privater S3-kompatibler Bucket | HTTPS-Endpunkt, Region, Bucketname, Access Key und Secret Key. Lesen, Schreiben, Auflisten, Löschen und benötigte Multipart-Operationen erlauben. |
| SMTP-Zugang | Host mit Port, Benutzer, Passwort, erlaubte Absenderadresse und Alarmempfänger. |
| Anwendungs-Secrets | Neues Datenbankpasswort und `NEXTAUTH_SECRET`; sicher extern aufbewahren. |
| Erstes Administratorkonto | Eigene E-Mail und Passwort für `SUPER_ADMIN`. |

Die vorhandene 2-GB-Abstimmung ist keine Kapazitätszusage. RAM, CPU und SSD-Platz
für Anwendung, Datenbank, alle Monitoring-Dienste, lokale Logs und überlappende
Updates einplanen. Builds in CI ausführen. Vor Freigabe Verbrauch und Last prüfen.
Der Server muss ausgehend DNS, HTTPS (Registry, Pakete, S3) und SMTP erreichen können.

In der Provider-Firewall SSH auf administrative Quellen und die vorgesehenen
CI-Runner begrenzen; 80/443 öffentlich zulassen. Datenbank, Redis und Monitoring
erhalten keine öffentlichen Ports. Swarm-Ports nicht öffentlich öffnen; bei
späteren zusätzlichen Nodes nur zwischen den Nodes freigeben.

Grundlagen: [Docker auf Ubuntu](https://docs.docker.com/engine/install/ubuntu/),
[GHCR-Authentifizierung](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
und [Certbot](https://eff-certbot.readthedocs.io/en/stable/using.html).

## 2. Repository vor dem ersten Image-Build anpassen

Auf dem Mac klonen, Änderungen prüfen, committen und pushen. Ein bloßes Setzen
einer neuen Domain in einer Env-Datei reicht nicht:

| Datei / Bereich | Anpassung bei eigener Domain oder eigenem GitHub-Namespace |
| --- | --- |
| `services/nginx/default.conf` | `server_name`, Weiterleitungen und beide Zertifikatspfade auf die neue Hauptdomain und `www` ändern. |
| `.github/workflows/build-deploy-*.yml` | GHCR-Namespace und Paketnamen für Anwendung, Migration und Nginx. |
| `production/deploy.sh`, `production/migrate.sh` | Dieselben Image-Namen wie in den Build-Workflows. |
| `.github/workflows/observability.yml`, `production/observability/compose.swarm.yml` | Derselbe Namespace für das projektspezifische Loki-Image. |
| `.github/workflows/deploy-production-service.yml`, weitere Smoke-Konfiguration | HTTPS- und Smoke-Test-Ziel auf die neue Domain setzen. |
| Spätere Serverkonfiguration | `NEXTAUTH_URL` und `GRAFANA_ROOT_URL` auf die neue Domain setzen. |

Verbleibende Stellen suchen und bewusst prüfen, einschließlich Tests mit erwarteten
Image-Namen; externe Images wie cAdvisor nicht umbenennen:

```sh
rg -n 'alex-schneider-dev\.de|ghcr\.io/alexschneider-dev' .github production services testing
```

Bei Nutzung des bestehenden Repositorys und seiner Images bleibt der Namespace
unverändert. Neue Domain-Konfiguration muss trotzdem im gebauten Nginx-Image liegen.
Die Stack-Namen `projekt`, `projekt-edge`, `observability` und Ressourcenbezeichnungen
in dieser Anleitung beibehalten; sie werden von Skripten und Monitoring vorausgesetzt.

In GitHub Actions vom gewünschten Commit folgende Workflows starten, zunächst
jeweils **`deploy=false`**:

1. **Next.js bereitstellen und Datenbank migrieren**: z. B. Version `1.00`.
2. **Nginx bauen und bereitstellen**: z. B. Version `1.00`.
3. **Monitoring prüfen und bereitstellen** auf `main`: veröffentlicht das Loki-Image.

Alle Builds müssen erfolgreich sein. Next.js und Migrations-Image erhalten denselben
Versionstag. Die Skripte akzeptieren Versionsnummern im Format `ZAHL.ZAHL`.
Automatische Produktions-Deployments erst nach Abschluss dieser Einrichtung zulassen.

## 3. Server vorbereiten und klonen

Ab hier auf dem Server als sudo-berechtigter Administrator arbeiten. In derselben
Bash-Sitzung bleiben; Platzhalter vor dem Ausführen ersetzen:

```sh
bash
set -euo pipefail
sudo apt-get update
sudo apt-get install -y ca-certificates curl git openssl python3 util-linux xz-utils certbot
git clone REPOSITORY_URL projekt
cd projekt
git checkout GEPRUEFTER_COMMIT
export PROJEKT_CHECKOUT="$PWD"
export PROJEKT_DOMAIN=app.example.com
export PROJEKT_EMAIL=betrieb@example.com
export PROJEKT_REGISTRY=ghcr.io/DEIN_GITHUB_NAMESPACE
export PROJEKT_APP_VERSION=1.00
export PROJEKT_NGINX_VERSION=1.00
```

Für Git-over-SSH den Server-Deploy-Key beim Repository hinterlegen und den
Git-Hostschlüssel verifizieren. Dieser Schlüssel ist unabhängig vom späteren
CI-Schlüssel für die Anmeldung **auf** diesem Server.

Docker aus dem offiziellen Ubuntu-Paketrepository installieren (frischer Server
ohne konkurrierende Docker-Pakete):

```sh
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker info
```

Node.js 22 wird auch **auf dem Host unter sudo** von den Deployment-Werkzeugen
benötigt. Folgendes installiert die aktuelle 22er-Version aus dem offiziellen
[Node.js-Downloadverzeichnis](https://nodejs.org/download/release/latest-v22.x/)
mit SHA-256-Prüfung; mindestens 22.22.2 verwenden:

```sh
node_download=$(mktemp -d)
(
  cd "$node_download"
  curl -fsSLO https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt
  node_archive=$(awk '$2 ~ /^node-v22\..*-linux-x64.tar.xz$/ {print $2}' SHASUMS256.txt)
  test -n "$node_archive"
  curl -fsSLO "https://nodejs.org/dist/latest-v22.x/$node_archive"
  awk -v archive="$node_archive" '$2 == archive' SHASUMS256.txt | sha256sum -c -
  sudo tar -xJf "$node_archive" -C /usr/local --strip-components=1
)
sudo node --version
command -v flock
```

## 4. Registry, Swarm, Netze und Volumes

Root benötigt den Registry-Login, weil Deployments als root laufen:

```sh
read -r -p 'GitHub-Benutzer: ' registry_user
read -r -s -p 'GHCR-Token: ' registry_token
printf '\n'
printf '%s' "$registry_token" | sudo docker login ghcr.io -u "$registry_user" --password-stdin
unset registry_token
sudo docker pull "$PROJEKT_REGISTRY/projekt:$PROJEKT_APP_VERSION"
sudo docker pull "$PROJEKT_REGISTRY/projekt-migration:$PROJEKT_APP_VERSION"
sudo docker pull "$PROJEKT_REGISTRY/nginx-projekt:$PROJEKT_NGINX_VERSION"
```

Token nicht in Befehlsargumenten, Git oder Chat hinterlegen. Auch der Pull des
Loki-Images aus der Monitoring-Compose muss mit diesem Zugang funktionieren.

`SERVER_IP` durch eine dauerhaft erreichbare Adresse dieses Servers ersetzen.
Vorher prüfen, dass die beiden angegebenen Subnetze nicht kollidieren:

```sh
sudo docker swarm init --advertise-addr SERVER_IP
sudo docker info --format '{{.Swarm.ControlAvailable}}'
sudo docker network create --driver overlay --attachable projekt_net
sudo docker network create --driver overlay --subnet 10.253.0.0/24 projekt_frontend
sudo docker network create --driver overlay --subnet 10.254.0.0/24 projekt_grafana_proxy
for volume in nextjs_cache nginx_cache postgres_data redis_data projekt_monitoring_backup; do
  sudo docker volume create "$volume"
done
manager_id=$(sudo docker info --format '{{.Swarm.NodeID}}')
sudo docker node update --label-add observability=true "$manager_id"
sudo install -d -o root -g root -m 0700 /etc/projekt /etc/projekt/bootstrap-env /etc/projekt/monitoring-storage
sudo install -d -o root -g root -m 0755 /var/www/certbot /usr/local/lib/projekt-deploy
```

Das attachable Anwendungsnetz ermöglicht den einmaligen Administrationscontainer
aus Schritt 9. Es veröffentlicht keine Host-Ports. Bei Wiederaufnahme einer
abgebrochenen Einrichtung vorhandene Ressourcen inspizieren, nicht löschen.

## 5. Erstes TLS-Zertifikat vor Nginx beschaffen

DNS für beide Namen prüfen. Port 80 muss erreichbar und noch frei sein:

```sh
sudo certbot certonly --standalone --non-interactive --agree-tos \
  --email "$PROJEKT_EMAIL" --cert-name "$PROJEKT_DOMAIN" \
  -d "$PROJEKT_DOMAIN" -d "www.$PROJEKT_DOMAIN"
sudo test -s "/etc/letsencrypt/live/$PROJEKT_DOMAIN/fullchain.pem"
sudo test -s "/etc/letsencrypt/live/$PROJEKT_DOMAIN/privkey.pem"
```

Diese Pfade müssen exakt mit dem gebauten Nginx übereinstimmen. Falls `www` nicht
verwendet wird, Nginx und Zertifikatsnamenliste gemeinsam entsprechend ändern.
Ein DNS-Proxy muss die ACME-Challenge durchlassen. Nginx kann ohne die Zertifikate
nicht starten. Die dauerhafte Erneuerung wird in Schritt 11 auf Webroot umgestellt.

## 6. Anwendungs-Secrets erzeugen

Nur auf dem neuen Server mit **leerer Datenbank und ohne vorhandenes Manifest**:

```sh
sudo node --input-type=module <<'JS'
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const password = randomBytes(32).toString('hex');
const secret = randomBytes(32).toString('hex');
writeFileSync('/etc/projekt/bootstrap-env/postgres.env',
  `POSTGRES_USER=postgres\nPOSTGRES_DB=postgres\nPOSTGRES_PASSWORD=${password}\n`,
  { mode: 0o600, flag: 'wx' });
writeFileSync('/etc/projekt/bootstrap-env/nextjs.env',
  `DATABASE_URL=postgresql://postgres:${password}@projekt_postgres:5432/postgres\nNEXTAUTH_SECRET=${secret}\nREDIS_URL=redis://projekt_redis:6379\n`,
  { mode: 0o600, flag: 'wx' });
JS
printf 'NEXTAUTH_URL=https://%s\n' "$PROJEKT_DOMAIN" | sudo tee -a /etc/projekt/bootstrap-env/nextjs.env >/dev/null
sudo node production/prepare-config.mjs /etc/projekt/bootstrap-env /etc/projekt/runtime.json r1
```

Die Vorschau zeigt Variablennamen. Nach deren Prüfung die Datei und Swarm Secrets erstellen:

```sh
sudo node production/prepare-config.mjs /etc/projekt/bootstrap-env /etc/projekt/runtime.json r1 --apply
sudo docker secret ls
sudo docker config ls
```

Bei einem Teilerfolg nicht blind wiederholen: Secrets und Manifest prüfen und eine
neue Revision mit neuem Ausgabepfad verwenden. `runtime.json` enthält ausschließlich
Umgebungsvariablen und Secret-/Config-Verweise. Replikate, Limits, Netzwerke und
Update-Strategien stammen aus `production/compose.swarm.yml`; Next.js bleibt `start-first`.

## 7. Deployment-Werkzeuge installieren und ersten Stack anlegen

```sh
sudo install -o root -g root -m 0755 \
  production/install-release.sh production/deploy.sh production/deploy-stack.sh production/migrate.sh \
  /usr/local/lib/projekt-deploy/
sudo install -o root -g root -m 0644 \
  production/compose.swarm.yml production/runtime-overlay.mjs production/compose.edge.yml production/edge-haproxy.cfg \
  /usr/local/lib/projekt-deploy/
```

`deploy-stack.sh` liest die Images aus vorhandenen Services und eignet sich daher
noch nicht für den allerersten Start. Einmalig direkt aus Compose und dem gefilterten
Runtime-Overlay bereitstellen. Der Edge-Stack wird erst nach der Migration gestartet:

```sh
sudo env \
  NEXTJS_IMAGE="$PROJEKT_REGISTRY/projekt:$PROJEKT_APP_VERSION" \
  NGINX_IMAGE="$PROJEKT_REGISTRY/nginx-projekt:$PROJEKT_NGINX_VERSION" \
  POSTGRES_IMAGE=postgres:17 REDIS_IMAGE=redis:7-alpine \
  bash -euo pipefail <<'SH'
cd /usr/local/lib/projekt-deploy
umask 077
overlay=$(mktemp /etc/projekt/bootstrap-overlay.XXXXXXXX.json)
trap 'rm -f "$overlay"' EXIT
node runtime-overlay.mjs /etc/projekt/runtime.json "$overlay"
docker stack config -c compose.swarm.yml -c "$overlay" >/dev/null
docker stack deploy --with-registry-auth -c compose.swarm.yml -c "$overlay" projekt
SH
sudo docker stack services projekt
sudo docker stack ps --no-trunc projekt
```

Für reproduzierbare Installationen können PostgreSQL und Redis vor diesem Schritt
auf geprüfte Image-Digests festgelegt werden. Spätere Stack-Deployments bewahren die
laufenden Image-Referenzen. Alle vier Dienste müssen starten; bei Fehlern die
Task-Ausgabe und `sudo docker service logs --tail 100 projekt_SERVICE` prüfen.

## 8. Datenbank migrieren

Warten, bis PostgreSQL bereit ist:

```sh
postgres_container=$(sudo docker ps -q --filter label=com.docker.swarm.service.name=projekt_postgres --filter health=healthy)
test -n "$postgres_container"
sudo docker exec "$postgres_container" pg_isready -U postgres -d postgres
sudo /usr/local/lib/projekt-deploy/migrate.sh "$PROJEKT_APP_VERSION"
```

Erst nach erfolgreicher Migration fortfahren. Das Skript verwendet das Secret und
die Startkonfiguration des bereits angelegten Next.js-Service. Ein fehlgeschlagener
Lauf ist kein Anlass, Datenvolumes zu löschen. Der spätere CI-Release führt ebenfalls
Migrationen aus; eine Image-Rücksetzung macht Datenbankänderungen nicht rückgängig.

## 9. Erstes SUPER_ADMIN-Konto anlegen

Das schlanke Produktionsimage enthält das Kontenskript nicht als zugesichertes
Administrationswerkzeug. Ein einmaliger Node-Container verwendet deshalb einen
separaten Quellcodeexport und die bereits geschützte Env-Datei. Dafür werden
Abhängigkeiten installiert, aber kein Next.js-Produktionsbuild ausgeführt:

```sh
admin_source=$(mktemp -d /tmp/projekt-admin.XXXXXXXX)
git archive HEAD | tar -x -C "$admin_source"
sudo docker run --rm -it --network projekt_net \
  --env-file /etc/projekt/bootstrap-env/nextjs.env \
  --mount "type=bind,src=$admin_source,dst=/app" \
  -w /app node:22-bookworm-slim \
  sh -ec 'npm ci --no-audit && npx prisma generate && npm run auth:create-user -- admin@example.com SUPER_ADMIN Administration'
```

`admin@example.com` vorher durch die tatsächliche Adresse ersetzen. Das Passwort
wird interaktiv verdeckt abgefragt. Nur einen geprüften Commit verwenden;
dieser Container erhält Zugriff auf Produktions-Secrets. Der Checkout bleibt
unverändert. Nach erfolgreicher Kontoanlage den temporären Export entfernen:

```sh
sudo rm -rf -- "$admin_source"
```

## 10. Monitoring und Sicherungen vollständig installieren

```sh
sudo install -o root -g root -m 0600 production/observability/settings.env.example /etc/projekt/observability.env
sudoedit /etc/projekt/observability.env
sudo install -o root -g root -m 0600 /dev/null /etc/projekt/monitoring-input.json
sudoedit /etc/projekt/monitoring-input.json
```

In `observability.env` alle `REPLACE_WITH_…`-Werte ersetzen und
`GRAFANA_ROOT_URL=https://DEINE_DOMAIN/grafana/` setzen. `OBS_SECRET_REVISION=r1`
für diese Neuinstallation belassen. Shell-Werte bei Bedarf korrekt quotieren.
Der Inhalt von `monitoring-input.json` hat diese Form, mit echten Werten ausschließlich
im Editor auf dem Server:

```json
{
  "s3AccessKey": "S3_ACCESS_KEY",
  "s3SecretKey": "S3_SECRET_KEY",
  "smtpPassword": "SMTP_PASSWORT"
}
```

Einen eigenen Bucket für diese Installation verwenden. Die Monitoring-Daten und
Backups liegen unter `projekt/production/`; den Namespace nicht mit einer anderen
Installation teilen. Lifecycle-Regeln dürfen die benötigten Daten nicht vorzeitig löschen.

```sh
sudo bash -c 'set -a; source /etc/projekt/observability.env; set +a; node production/observability/prepare-secrets.mjs /etc/projekt/monitoring-input.json /etc/projekt/monitoring-initial'
postgres_container=$(sudo docker ps -q --filter label=com.docker.swarm.service.name=projekt_postgres --filter health=healthy)
test -n "$postgres_container"
sudo cat /etc/projekt/monitoring-initial/postgres-role.sql | sudo docker exec -i "$postgres_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres
sudo bash production/observability/storage-admin.sh prepare
sudo install -o root -g root -m 0755 production/observability/install-release.sh /usr/local/lib/projekt-deploy/install-observability-release.sh
release_source=$(mktemp -d /tmp/projekt-observability.XXXXXXXX)
git archive HEAD production/observability | tar -x -C "$release_source" --strip-components=2
sudo /usr/local/lib/projekt-deploy/install-observability-release.sh "$release_source"
```

Der Installer prüft den Stack und aktiviert beide Backup-Timer erst nach erfolgreichem
Deployment. Bei einem Fehler die Ursache beheben und nicht die Installation als
abgeschlossen behandeln. Secret-Vorbereitung und SQL-Rollenanlage nicht erneut
ungeprüft ausführen. Nach Erfolg den temporären Release-Export entfernen:

```sh
rm -rf -- "$release_source"
sudo docker stack services observability
sudo systemctl start projekt-monitoring-backup.service
sudo systemctl start projekt-postgres-backup.service
sudo journalctl -u projekt-monitoring-backup.service -u projekt-postgres-backup.service -n 80 --no-pager
sudo systemctl list-timers 'projekt-*'
```

Alle 15 Monitoring-Dienste müssen laufen. Beide ersten Sicherungen müssen den
Upload und vollständigen Rücklese-/Prüfsummenvergleich bestehen. Retention und
isolierten Restore gemäß [Backup-Dokumentation](../production/observability/README.md#postgresql-sicherungen)
prüfen. Secrets und private Konfiguration separat sichern: Sie sind kein Bestandteil
der Datenbanksicherung. Swarm bietet keinen normalen Export der Secret-Inhalte.

## 11. Öffentlichen Eingang und Zertifikatserneuerung aktivieren

```sh
(
  cd /usr/local/lib/projekt-deploy
  sudo docker stack deploy -c compose.edge.yml projekt-edge
)
sudo docker stack services projekt-edge
curl --fail --silent --show-error "https://$PROJEKT_DOMAIN/" >/dev/null
```

HAProxy veröffentlicht 80/443 und übergibt an Nginx mit PROXY-Protokoll.
Zertifikate werden weiterhin in Nginx verwendet. Nun Certbot vom einmaligen
Standalone-Verfahren auf die durch Nginx erreichbare Webroot-Challenge umstellen:

```sh
sudo certbot reconfigure --cert-name "$PROJEKT_DOMAIN" --webroot --webroot-path /var/www/certbot
sudo install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/projekt-nginx >/dev/null <<'SH'
#!/bin/sh
set -eu
for container in $(docker ps -q --filter label=com.docker.swarm.service.name=projekt_nginx); do
  docker exec "$container" nginx -t
  docker exec "$container" nginx -s reload
done
SH
sudo chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/projekt-nginx
sudo /etc/letsencrypt/renewal-hooks/deploy/projekt-nginx
sudo certbot renew --dry-run
sudo systemctl enable --now certbot.timer
sudo systemctl status certbot.timer --no-pager
```

Die Challenge muss für Hauptdomain und `www` funktionieren. Den Erneuerungstest
nicht überspringen: Der frühere Standalone-Modus könnte nach Start des Edge-Stacks
Port 80 nicht mehr selbst belegen.

## 12. GitHub-Deployments freischalten

Auf dem Mac einen dedizierten CI-Schlüssel erzeugen, z. B.:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/projekt_ci -C projekt-ci
```

Der automatisierte Workflow erwartet einen ohne interaktive Passphrase nutzbaren
Schlüssel. Den öffentlichen Schlüssel beim vorgesehenen Serverbenutzer in
`~/.ssh/authorized_keys` hinterlegen (Verzeichnis `0700`, Datei `0600`). Den privaten
Schlüssel ausschließlich als GitHub-Secret speichern. Dieses Deploy-Konto darf
Repository-Code als root installieren und ist deshalb ein Produktionsadministrator.

Auf dem Server:

```sh
sudo visudo -f /etc/sudoers.d/projekt-deploy
```

Die Regeln aus `production/sudoers.example` übernehmen; `USER` durch den echten
Deploy-Benutzer ersetzen. Zusätzlich eintragen, wieder mit echtem Benutzernamen:

```sudoers
USER ALL=(root) NOPASSWD: /usr/local/lib/projekt-deploy/install-observability-release.sh /tmp/projekt-observability.*
```

```sh
sudo visudo -c
```

In GitHub unter **Settings → Environments → Production → Secrets** hinterlegen:

| Secret | Wert |
| --- | --- |
| `PROD_HOST` | Server-IP oder SSH-Hostname, ohne `https://`. |
| `PROD_USER` | Der konfigurierte Deploy-Benutzer. |
| `PROD_SSH_KEY` | Vollständiger privater CI-Schlüssel einschließlich Kopf-/Fußzeile. |
| `PROD_KNOWN_HOSTS` | Verifizierte OpenSSH-known_hosts-Zeile für exakt `PROD_HOST`. |

Hostschlüssel-Fingerprint über die vertrauenswürdige Serverkonsole mit
`sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` prüfen. Einen per
`ssh-keyscan` gewonnenen Schlüssel erst nach Fingerprint-Abgleich übernehmen.
GitHub-Environment-Regeln und Branch-Schutz passend setzen.

Nun **Stack-Konfiguration für Produktion bereitstellen** ausführen. Es muss alle
fünf bereits existierenden Anwendungs-/Edge-Dienste erfolgreich übernehmen.
Anschließend funktionieren die Build-Workflows mit `deploy=true`; Monitoring hat
seinen eigenen Workflow. Änderungen an den beiden `install-release.sh`-Dateien
müssen weiterhin einmalig durch einen Administrator auf dem Server installiert werden.

## 13. Abnahme und laufender Betrieb

```sh
sudo docker stack services projekt
sudo docker stack services projekt-edge
sudo docker stack services observability
sudo docker stack ps --no-trunc projekt
sudo bash /usr/local/lib/projekt-observability/current/check-health.sh
free -h
df -h
sudo docker stats --no-stream
```

- HTTP leitet auf HTTPS um; Zertifikat und `www`-Weiterleitung stimmen.
- Homepage, Anmeldung, Abmeldung und Datenbankzugriff funktionieren.
- `SUPER_ADMIN` erreicht `/grafana/`; anonyme Benutzer, `USER` und `ADMIN` nicht.
- Metriken, Logs und Traces kommen an; ein Grafana-Testalarm erreicht den Empfänger.
- Beide Backup-Timer sind aktiv, erste Sicherungen geprüft und ein isolierter Restore getestet.
- Mindestens 24 Stunden einschließlich Dashboard-Abfragen, Backup und App-Update
  auf OOMs, Speicherverbrauch, freien Plattenplatz und Swap-Aktivität beobachten.

Die privaten Bootstrap-Dateien und Monitoring-Eingaben nach sicherer externer
Ablage entfernen oder als root-only Wiederanlaufmaterial verwahren; niemals committen.
Den GHCR-Token vor Ablauf erneuern. `docker system prune --volumes` gehört nicht
zur Wartung dieses Servers. Ein Service-Rollback stellt keine Datenbank wieder her.

Für Updates und Secret-Rotation siehe [Produktionsbetrieb](../production/README.md),
für Monitoring-Abnahme und Wiederherstellung die
[Monitoring-Anleitung](../production/observability/README.md).

## Fehler gezielt eingrenzen

| Fehler | Nächster Schritt |
| --- | --- |
| `No such image` / `unauthorized` | Tag, Namespace, erfolgreich abgeschlossenen Build und Root-GHCR-Login prüfen. |
| `network ... not found` / externes Volume fehlt | Schritt 4 und Ressourcennamen prüfen. |
| Nginx startet nicht | Zertifikatspfade, Image mit richtiger Domain und Service-Logs prüfen. |
| Migration scheitert | PostgreSQL-Bereitschaft, Datenbank-URL, Migrations-Image und Secret-Zuweisung prüfen. |
| Monitoring-Installer scheitert | Node-Label, alle Settings, S3-Rechte, Monitoring-DB-Rolle und Loki-Pull prüfen. |
| CI scheitert bei SSH oder sudo | Schlüssel, verifizierte known_hosts, Environment `Production` und sudoers prüfen. |
| Zertifikatserneuerung scheitert | DNS, Port 80, Challenge-Pfad und Webroot-Konfiguration prüfen. |

Bei Fehlern den nächsten abhängigen Schritt nicht ausführen. Keine Volumes oder
Secrets als pauschale Fehlerbehebung löschen. Bei Teilinstallationen zuerst den
tatsächlichen Ressourcenstand prüfen; diese Anleitung ist kein idempotentes Skript.
