# Vollständiges Monitoring

Der separate Swarm-Stack `observability` enthält 15 Monitoring-Dienste:
Grafana, Prometheus, Loki, Tempo, Alloy, node_exporter, cAdvisor,
PostgreSQL-/Redis-/Nginx-Exporter, Swarm-Exporter sowie
Thanos Sidecar, Store, Query und Compact. Die Anwendung bleibt im Stack `projekt`.

Die Dateien bereiten die Installation vor. Es wird kein Server automatisch umgestellt.
S3 und SMTP müssen vor der Installation eingerichtet sein.

Alle Monitoring-Container verwenden Docker-Logrotation mit `json-file`,
`max-size: "20m"` und `max-file: "5"` (ca. 100 MB pro Container).
Ein Deployment übernimmt diese Einstellungen durch Ersetzen der Container.
Die Grenze gilt für Docker-stdout/stderr-Logs; Datenvolumes und S3-Aufbewahrung
bleiben davon unabhängig. Details und Kontrolle:
[Lokale Docker-Logs](../README.md#lokale-docker-logs).

Elasticsearch und dessen Exporter sind nicht enthalten; `ELASTICSEARCH_URL` wird nicht benötigt. Nicht vorhandene Chat-, Cron- und
Datenbank-Backup-Dienste werden nicht als scheinbar funktionierende Datenquellen angezeigt.

## Datenfluss und Zugriff

- Next.js veröffentlicht Prozessmetriken und Request-Histogramme auf dem internen
  Port 9464. OpenTelemetry sendet Next.js-/Fetch-/Prisma-Traces an Alloy.
- Alloy liest Docker-Logs pro Node und empfängt OTLP sowie Browser-Telemetrie.
  Der Browser erfasst Fehler, Web Vitals und Netzwerk-Traces ohne Console-Aufzeichnung
  oder persistente Benutzersitzung. URLs und sensible Felder werden vor dem Versand bereinigt.
- Prometheus erfasst Metriken alle 30 Sekunden. Thanos lädt abgeschlossene Blöcke
  nach S3 und verbindet aktuelle und historische Abfragen.
- Grafana unter `/grafana/` verwendet die bestehende NextAuth-Anmeldung. Jeder
  Zugriff wird serverseitig gegen den aktuellen Benutzer geprüft. Nur `SUPER_ADMIN` erhält
  Zugriff mit der Grafana-Organisationsrolle `Admin`; `ADMIN` und `USER` werden abgewiesen.
  Das ist keine globale Grafana-Serveradministratorrolle.
- Die Homepage bleibt nach der Anmeldung das Ziel. Monitoring ist über die Navigation
  im internen Bereich erreichbar. Nicht angemeldete Grafana-Aufrufe führen zum Login.
- Nur Nginx und Grafana gehören in `projekt_grafana_proxy` mit Subnetz
  `10.254.0.0/24`. Nginx überschreibt Identitäts-/Rollenheader und entfernt Grafana-Cookies
  sowie Authorization. Grafana vertraut Auth-Proxy-Headern nur aus diesem Subnetz.
- Kein Monitoring-Dienst veröffentlicht Host-Ports. `/collect` ist für Browser
  öffentlich, auf POST, 128 KiB und 5 Anfragen/s pro IP begrenzt.
  Interne `/metrics`, OTLP und Nginx `stub_status` bleiben im Docker-Netz.
- Docker-Socket-Mounts bei Alloy und Swarm-Exporter sind privilegierter Zugriff:
  `:ro` verhindert keine schreibenden Docker-API-Aufrufe. Nur vertrauenswürdige
  Images und Administratoren dürfen Zugriff auf diese Dienste erhalten.

## 2 GB RAM und Swap

Die Konfiguration ist ein Versuch für geringe Last, keine zugesicherte Kapazität.
Alle 15 Dienste bleiben aktiv. Kleinere Go-Speicherziele, begrenzte Abfrageparallelität,
30-Sekunden-Scrapes und `stop-first`-Updates der Monitoring-Dienste reduzieren Spitzen.
Containerlimits gelten einzeln; ihre Summe ist weder reservierter RAM noch eine
Garantie für die Nutzung von Swap. Swarm bietet hier kein separat konfiguriertes
Swap-Budget je Dienst. Docker-/Kernel-Unterstützung auf dem Zielhost prüfen.

Die gemessene Referenz lag bei etwa 1,42 GiB Monitoring-RAM; auf dem Zielhost waren
vor der Installation etwa 990 MiB RAM verfügbar. Der tatsächliche Bedarf kann mit
Datenvolumen, Abfragen, S3-Störungen, Verdichtung und Deployments deutlich steigen.
Bei dauerhaftem Ein-/Auslagern oder OOM-Abbrüchen RAM erhöhen oder Dienste auslagern.
Builds und umfangreiche Integrationstests auf CI beziehungsweise dem Entwicklungsrechner ausführen.

Das cAdvisor-Limit beträgt 256 MiB. Mit 128 MiB wurden auf dem Zielhost wiederholte
`memory.events:max`-Ereignisse, Swap-Nutzung und Speicherwartezeiten gemessen.
Das höhere Limit schafft Spielraum für diesen Container, reserviert jedoch keinen
zusätzlichen RAM und garantiert keine Entlastung des Hosts. Nach der Änderung
cAdvisor-Verbrauch, `memory.pressure` und `vmstat` erneut prüfen. Sammelintervall
(30 Sekunden) und erfasste Metriken bleiben unverändert.

Nach Installation mindestens 24 Stunden einschließlich Dashboard-Abfragen,
Logsuche, Thanos-Verdichtung, Grafana-Sicherung und Anwendungs-Update beobachten:

```sh
free -h
sudo docker stats --no-stream
vmstat 1 60
sudo bash production/observability/stability-report.sh 24
```

Dashboards und Alarme zeigen freien RAM, Swap-Belegung, Swap-Aktivität und OOMs.
Belegter Swap allein beweist keine laufende Überlastung; `si`/`so` und Antwortzeiten
mitbewerten. Reserven für Betriebssystem, Datenbank und überlappende App-Updates behalten.

## Vorbereitung auf dem vorgesehenen Manager

Vor der ersten Installation den Workflow **Monitoring prüfen und bereitstellen**
auf `main` mit `deploy=false` erfolgreich ausführen. Er veröffentlicht das geprüfte
projektspezifische Loki-Image. Der Server benötigt Lesezugriff auf das GHCR-Paket
`projekt-loki`; Details stehen in [der Image-Anleitung](../../services/loki/README.md).

Benötigt: Docker Swarm, Node.js 22, Python 3, Bash und `flock`. Der gelabelte
Monitoring-Node ist der lokale Manager; dort liegen persistente Volumes und der
Backup-Timer. Für mehrere Manager ist eine gesonderte Speicherplanung erforderlich.

1. Eigenen privaten S3-Bucket und SMTP-Zugang bereitstellen. `settings.env.example`
   nach `/etc/projekt/observability.env` kopieren (`root:root`, Modus `0600`) und
   alle Platzhalter ersetzen. S3-Endpunkt als HTTPS-Origin ohne Pfad angeben.
2. Prüfen, dass `10.254.0.0/24` nicht kollidiert. Bei einer Änderung auch
   Grafanas `GF_AUTH_PROXY_WHITELIST` und die Prüfung in `deploy.sh` anpassen.
3. Einmalig die Infrastruktur vorbereiten:

```sh
sudo docker node update --label-add observability=true MANAGER_NODE_NAME
sudo docker network create --driver overlay --subnet 10.254.0.0/24 projekt_grafana_proxy
sudo docker volume create projekt_monitoring_backup
sudo install -d -o root -g root -m 0700 /etc/projekt/monitoring-storage
```

Bestehende Ressourcen prüfen statt sie zu löschen oder neu anzulegen.
Das bestehende `projekt_net` wird weiterverwendet.

## Secrets und PostgreSQL-Rolle

Alle Passwörter und S3-Schlüssel werden als versionierte Docker Swarm Secrets
unter `/run/secrets/` bereitgestellt. Die öffentliche `observability.env` enthält
nur Endpunkte, Namen und andere nicht geheime Einstellungen. `_FILE`-Variablen
enthalten Dateipfade, niemals den Secret-Inhalt.

Auch die Grafana-Sicherung verwendet das S3-Secret: Für jeden AWS-CLI-Aufruf
startet das Werkzeug einen kurzlebigen Swarm-Service auf dem lokalen Manager.
Dieser erhält das Secret direkt von Docker und wird anschließend entfernt.
Auf dem Host ist keine dauerhafte AWS-Zugangsdaten-Datei erforderlich.
Das Verzeichnis `monitoring-storage` enthält ausschließlich temporäre Arbeitsdaten.
Bei einem hart abgebrochenen Backup eventuell zurückgebliebene Services mit
Präfix `projekt-monitoring-s3-` prüfen und nach Ende des Laufs entfernen.


Eine private JSON-Datei außerhalb des Repositorys mit den Schlüsseln
`s3AccessKey`, `s3SecretKey` und `smtpPassword` anlegen (`0600`). Keine Schlüssel
in Git, Shell-Befehlsargumenten oder Chatnachrichten hinterlegen.

Aus einem vertrauenswürdigen Checkout im Repository-Hauptverzeichnis:

```sh
sudo bash -c 'set -a; source /etc/projekt/observability.env; set +a; node production/observability/prepare-secrets.mjs /etc/projekt/monitoring-input.json /etc/projekt/monitoring-initial'
```

Das Werkzeug erstellt fünf versionierte Swarm Secrets und eine SQL-Datei mit
zufälligem Passwort für einen dedizierten PostgreSQL-Monitoring-Benutzer.
Es überschreibt kein vorhandenes Ausgabeverzeichnis und keine Secrets.
Nach einem Teilerfolg vorhandene Secret-Namen prüfen; für einen neuen Versuch
Revision und Ausgabeverzeichnis ändern. Die private JSON-Datei sicher verwahren
oder nach gesicherter externer Ablage entfernen.

Die SQL-Datei einmalig auf der bestehenden Datenbank ausführen:

```sh
postgres_container=$(sudo docker ps -q --filter label=com.docker.swarm.service.name=projekt_postgres)
sudo cat /etc/projekt/monitoring-initial/postgres-role.sql | sudo docker exec -i "$postgres_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres
sudo bash production/observability/storage-admin.sh prepare
```

Die Rolle hat `pg_monitor` und höchstens fünf Verbindungen. Ein vorhandener Benutzer
wird absichtlich nicht überschrieben. Bei Secret-Rotation das Datenbankpasswort
kontrolliert zusammen mit dem Secret aktualisieren.
Redis wird entsprechend dem bestehenden privaten Anwendungsdienst ohne Passwort
abgefragt. Bei Einführung von Redis-ACLs zuerst Exporter und Secret-Zuweisung anpassen.

`storage-admin.sh prepare` prüft Schreiben, Lesen und Löschen mit ausschließlich
neuen Testobjekten in den Monitoring-Präfixen. Es migriert oder verändert keine
bestehenden Tempo-Daten; diese Installation beginnt direkt mit S3.

Bei fehlgeschlagenen temporären S3-Tasks sichert das Werkzeug den Task-Status
und die letzten Logzeilen vor der Bereinigung in
`/etc/projekt/monitoring-storage/s3-failure-*.json` (Modus `0600`).
Die Terminalmeldung nennt einen erkannten S3-Fehlercode und den Dateipfad.
Die private Diagnose lokal prüfen und nach Behebung löschen; Rohlogs nicht
ungeprüft weitergeben. Für einen erneuten Speichertest keine Secrets neu erzeugen.

## S3-Zugangsdaten vor der ersten Bereitstellung korrigieren

Wenn noch kein Service die S3-Secrets verwendet, die Schlüssel in der privaten
JSON-Datei und Endpunkt, Bucket sowie Region in `observability.env` korrigieren.
Dann ausschließlich die beiden S3-Secrets ersetzen:

```sh
sudo bash -c 'set -a; source /etc/projekt/observability.env; set +a; node production/observability/replace-s3-secrets.mjs /etc/projekt/monitoring-input.json'
sudo bash production/observability/storage-admin.sh prepare
```

Das Werkzeug prüft Service-Referenzen vor Änderungen und verweigert den Austausch
verwendeter Secrets. Es ersetzt ungenutzte S3-Secrets unter den bisherigen Namen;
PostgreSQL, Grafana und SMTP bleiben unverändert. Der Austausch beider Secrets ist
nicht atomar. Nach einem Teilerfolg kann derselbe Befehl erneut ausgeführt werden.
Für eine bereits laufende Installation ist eine versionierte Rotation erforderlich.

## S3-Anbieter einer laufenden Installation wechseln

Zuerst die aktualisierten Skripte über den regulären Monitoring-Release bereitstellen,
damit auch die installierten Sicherungsjobs die separate S3-Revision unterstützen.
Die bisherige Konfiguration dabei noch beibehalten.

Für einen neuen Bucket ohne Übernahme der bisherigen Remote-Daten eine Kopie
von `/etc/projekt/observability.env` als `/etc/projekt/observability-r2.env`
anlegen (root:root, Modus `0600`). Darin `LOKI_S3_ENDPOINT`, `LOKI_S3_BUCKET`
und `LOKI_S3_REGION` ändern sowie eine neue `OBS_S3_SECRET_REVISION` setzen.
`OBS_SECRET_REVISION` unverändert lassen: Grafana, SMTP und PostgreSQL verwenden
weiterhin diese Revision. Ohne separate S3-Revision bleibt das bisherige Verhalten.
Für Cloudflare R2 gilt Region `auto`; der HTTPS-Endpunkt enthält keinen Bucketpfad.
Bei EU-Buckets den EU-Endpunkt aus dem Dashboard verwenden.

Die neuen Schlüssel in `/etc/projekt/r2-input.json` als `s3AccessKey` und
`s3SecretKey` speichern (root:root, Modus `0600`). Danach im aktualisierten
Repository auf dem Swarm-Manager ausführen:

```sh
sudo bash -c 'set -a; source /etc/projekt/observability-r2.env; set +a; node production/observability/replace-s3-secrets.mjs /etc/projekt/r2-input.json'
sudo bash production/observability/storage-admin.sh prepare /etc/projekt/observability-r2.env
```

Die neue Revision muss unbenutzt sein. Verwendete Secrets werden abgewiesen;
die bisherigen S3-Secrets bleiben für einen Rückweg bestehen. Der Speichertest
prüft neue Testobjekte, nicht die vollständige Kompatibilität aller Dienste.
Bei Fehlern nicht bereitstellen.

Nach erfolgreichem Speichertest bereitstellen und die gemeinsame Konfiguration
für Sicherungsjobs erst nach erfolgreichem Deployment aktualisieren:

```sh
sudo bash production/observability/deploy.sh /etc/projekt/observability-r2.env
sudo cp -p /etc/projekt/observability.env /etc/projekt/observability-before-r2.env
sudo install -o root -g root -m 600 /etc/projekt/observability-r2.env /etc/projekt/observability.env
```

Befehle einzeln ausführen und bei Fehlern stoppen. Danach neue Logs, Traces,
Metrikabfragen und Sicherungen prüfen. Es werden keine alten Bucketobjekte
kopiert und keine lokalen Volumes gelöscht. Lokal vorhandene Daten können
weiterhin sichtbar sein oder später hochgeladen werden; insbesondere ersetzt
der Bucketwechsel keine Bereinigung lokaler WALs, Caches oder Upload-Metadaten.
Auf fehlende historische Objekte und ausbleibende neue Uploads achten.
Die alten Remote-Daten sind über die neue Konfiguration nicht erreichbar.
Ein Rückwechsel kann wiederum Daten ausblenden, die ausschließlich in R2 liegen.

## Bereitstellung

1. Das Proxy-Netz muss vor dem nächsten Nginx-/Stack-Deploy existieren.
2. Next.js und Nginx mit den bestehenden Build-/Deploy-Workflows aktualisieren.
   Die App-Compose aktiviert `OBSERVABILITY_ENABLED` und den OTLP-Endpunkt.
   Abweichende Werte in `/etc/projekt/runtime.json` vorher abgleichen, da dieses
   Manifest die Compose-Umgebung ergänzen beziehungsweise überschreiben kann.
3. Den separaten Monitoring-Stack mit dauerhaftem, root-eigenem Release und
   Backup-Timer installieren:

```sh
release_source=$(mktemp -d /tmp/projekt-observability.XXXXXXXX)
git archive HEAD production/observability | tar -x -C "$release_source" --strip-components=2
sudo bash production/observability/install-release.sh "$release_source"
```

Das temporäre Upload-Verzeichnis nach erfolgreicher Installation entfernen.
Es enthält nur Repository-Dateien, keine Produktions-Secrets.

Der Deploy prüft Einstellungen, Secrets, Netz und Node-Platzierung, bevor er
Services verändert. Swarm Configs erhalten inhaltsabhängige Namen. Alte Configs
bleiben für Rollbacks erhalten. Anschließend müssen alle 15 Dienste, alle 16
Metrik-Jobs, Datenbank-/Redis-/Nginx-Verbindungen und Thanos-Abfragen
erfolgreich sein. Ein Fehler beendet das Deployment mit Fehlerstatus; es erfolgt
kein unkontrollierter Rollback des gesamten Stacks.

Für CI einmalig den Installer installieren:

```sh
sudo install -o root -g root -m 0755 production/observability/install-release.sh /usr/local/lib/projekt-deploy/install-observability-release.sh
sudo visudo -f /etc/sudoers.d/projekt-observability
```

Die passende Regel für den tatsächlichen Deploy-Benutzer eintragen:

```sudoers
alex ALL=(root) NOPASSWD: /usr/local/lib/projekt-deploy/install-observability-release.sh /tmp/projekt-observability.*
```

Mit `sudo visudo -c` prüfen. Der Benutzer ist damit wie beim App-Deployment ein
vertrauenswürdiger Produktionsadministrator. Der Workflow **Monitoring prüfen und
bereitstellen** prüft relevante Änderungen in Pull Requests. Bei einem Push auf
`main` mit Änderungen an Monitoring, Instrumentierung, Nginx, Loki oder dem Workflow
validiert er zuerst isoliert, veröffentlicht das geprüfte Loki-Image und deployt
anschließend automatisch. Die genauen Pfadfilter stehen im Workflow.
Manuelle Starts bleiben möglich: `deploy=false` prüft und veröffentlicht nur das
Image, `deploy=true` stellt anschließend bereit. Die Server-Vorbereitung und der
aktuelle CI-Installer müssen vor dem ersten automatischen Deployment vorhanden sein.
Der Workflow nutzt die vorhandenen `PROD_*`-Secrets und die gemeinsame
Produktions-Concurrency-Gruppe. Erfolgreiche Installation aktiviert den Backup-Timer.
Der oben gezeigte manuelle Installer aktiviert denselben Timer. Ein direkter Aufruf
von `deploy.sh` aktualisiert ausschließlich den Stack und ersetzt nicht den
installierten Backup-Code. Deshalb für neue Releases den Installer verwenden.

## Abnahme

- Als anonymer Benutzer sowie als `USER` und `ADMIN` darf kein Grafana-Zugriff möglich sein.
  Fremde `X-Webauth-*`-Header dürfen das nicht umgehen.
- Als `SUPER_ADMIN` Dashboard, Logs und Traces öffnen. Benutzer danach
  deaktivieren beziehungsweise Rolle entziehen und erneuten Zugriff prüfen.
- Testfehler im Browser und eine serverseitige Anfrage erzeugen, in Grafana
  nachsehen. Keine Anfrageinhalte, Cookies oder Zugangsdaten dürfen exportiert werden.
- In Grafana einen Testalarm an die konfigurierte E-Mail-Adresse senden.
- Erste Sicherung ausführen und den erfolgreichen Rücklese-/Prüfsummenvergleich prüfen:

```sh
sudo systemctl start projekt-monitoring-backup.service
sudo journalctl -u projekt-monitoring-backup.service -n 40 --no-pager
sudo systemctl status projekt-monitoring-backup.timer --no-pager
```

## Speicherung und Wiederherstellung

Alle Objekte liegen unter dem eigenen Präfix `projekt/production/`:

| Daten | Aufbewahrung / Pfad |
| --- | --- |
| Betriebslogs | unbegrenzt, `loki/` |
| Security-Logs einschließlich Nginx-Fehler | 30 Tage, ebenfalls `loki/` |
| Metriken | 730 Tage, `metrics/` über Thanos |
| Traces | 90 Tage, `tempo/` |
| PostgreSQL-Sicherungen | lokal 14 Tage, S3 unbegrenzt, `postgres/` |
| Grafana-Sicherungen | 30 Kalendertage und 12 Kalendermonate, `grafana-backups/` |

Nginx-Betriebslogs enthalten normalisierte Pfade ohne Querystring und Client-IP;
Pfade selbst können fachliche Kennungen enthalten. Andere Docker-Logs werden
unverändert gesammelt. Für neue Dienste und zusätzliche Logfelder deren Inhalte
und Aufbewahrung prüfen. Der allgemeine Fehlerhandler protokolliert keine rohen
Exception-Objekte. Der Collector lässt nur ausgewählte Span-Attribute passieren.

Prometheus hält lokal höchstens 15 Tage / 10 GB; das ist ein Retentionsziel, kein
hartes Gesamtlimit für WAL und Arbeitsdateien. Loki-WAL, Tempo-WAL, Alloy-Queues,
Thanos-Caches und Docker-Logs benötigen ebenfalls freien Plattenplatz.
Anwendungs-, Edge- und Monitoring-Container rotieren ihre Docker-Logs bei
10 MB und behalten drei Dateien; längere Ausfälle der Erfassung können daher Logs verlieren.
Bucket-Lifecycle-Regeln dürfen die genannten Präfixe nicht vorzeitig entfernen.

Die Grafana-Sicherung erstellt eine konsistente SQLite-Kopie, prüft deren Integrität,
lädt das Archiv hoch und verifiziert einen vollständigen Download per SHA-256.
Erst danach werden ausschließlich eigene abgelaufene Archivnamen gelöscht.
Die Sicherung enthält Grafana-Datenbank, Plugins und Image-Metadaten; Secrets,
private Einstellungen und Repository-Konfiguration separat sicher aufbewahren.

Für einen Restore in ein **neues leeres Volume** entpacken, SQLite prüfen und mit
der im Archiv genannten Grafana-Version isoliert starten. Erst nach Prüfung den
Produktionsdienst auf das neue Volume umstellen. Niemals über eine laufende
Grafana-Datenbank entpacken. Bei Hostverlust lesen Thanos und Tempo ihre S3-Daten
wieder; noch nicht hochgeladene Blöcke und lokale Queues können verloren gehen.

Zum Stoppen `sudo docker stack rm observability` verwenden und den Backup-Timer
stoppen. Volumes, Secrets und S3-Daten bleiben erhalten. Das ist kein vollständiger
Rollback der Anwendungsinstrumentierung; dafür `OBSERVABILITY_ENABLED=false`
setzen und Next.js neu bereitstellen. Alte Configs nicht vor Ablauf des
Rollback-Zeitraums entfernen.

## Lokale Prüfungen

```sh
npm run check
npm audit
npm run audit:dependencies
bash production/observability/validate.sh
python3 -m unittest discover -s production/observability -p 'test_*.py'
python3 production/observability/test-loki-query-integration.py
python3 production/observability/test-query-classification-integration.py
python3 production/observability/test-storage-integration.py
python3 production/observability/test-grafana-integration.py
docker build -t projekt-observability-nginx-check services/nginx
python3 production/observability/test-nginx-integration.py
node --experimental-strip-types --test testing/observability.test.mjs
```

Python-Integrationstests benötigen PyYAML 6.0.3 und Docker. Sie verwenden isolierte
Testcontainer und künstliche Daten ohne Produktions-Secrets. Sie ersetzen keine
SMTP-Zustellprüfung, Zielhost-Lastprüfung oder S3-Abnahme mit den späteren Zugangsdaten.

Technische Grundlagen: [Grafana Auth Proxy](https://grafana.com/docs/grafana/latest/setup-grafana/configure-access/configure-authentication/auth-proxy/),
[Alloy-Konfigurationsprüfung](https://grafana.com/docs/alloy/latest/reference/cli/validate/)
und [Thanos Sidecar](https://thanos.io/tip/components/sidecar.md/).


## Übernommene Korrekturen für Abfrageabbrüche

Loki verwendet das projektspezifische Image und den eng begrenzten Patch aus
[`services/loki`](../../services/loki/README.md). Nur bestätigte Kontext-Abbrüche
beim Laden von Chunks werden auf Debug protokolliert. Speicherfehler,
Berechtigungsfehler und Zeitüberschreitungen bleiben Fehler. Der Image-Build führt
die betroffenen Upstream-Pakettests aus.

Vor der ersten Installation den Workflow **Monitoring prüfen und bereitstellen**
auf `main` mit `deploy=false` ausführen: Er baut, prüft und veröffentlicht das Image
`ghcr.io/alexschneider-dev/projekt-loki:3.6.18-projekt.1`. Der Server benötigt
Lesezugriff auf dieses Paket. Der bestehende Docker-Login unter root muss bei einem
privaten Paket berechtigt sein; das Deployment reicht Registry-Zugangsdaten an
Swarm weiter. Das Image wird außerhalb des kleinen Produktionsservers gebaut.

Nginx gibt frühe Browser-Abbrüche bei Dashboard-Seiten und `/grafana/api/ds/query`
nicht sofort an Grafana weiter. Die Anmeldung und Rollenprüfung bleiben erhalten.
Andere APIs und Live-WebSockets behalten ihr bisheriges Abbruchverhalten. Bereits
angenommene Abfragen können dadurch länger Ressourcen belegen. Große Antworten
können beim Schreiben an den getrennten Client weiterhin abbrechen; der Test
`test-grafana-cancellation-integration.py` reproduziert auch diese Grenze.
Für diese Änderung das Nginx-Image neu bauen und bereitstellen.

Alloy markiert ausschließlich Grafanas `logger=context` / `Error writing to response`
mit TCP-Schreibfehler `broken pipe` oder `connection reset by peer` als
`query_event="response_peer_closed"`. Das Dashboard zeigt diese Originalmeldungen
im Diagnosepanel. Sie sind kein Nachweis eines harmlosen Browser-Abbruchs: Bei
wiederholten Meldungen Nginx-Logs und sichtbare Ladefehler prüfen. HTTP 500,
Schreib-Timeouts, andere Logger und andere Dienste bleiben im Fehlerpanel.
Die Integrationstests enthalten entsprechende Gegenbeispiele.

## PostgreSQL-Sicherungen

Der Release-Installer installiert und aktiviert zusätzlich `projekt-postgres-backup.timer`.
Bei bestehenden Installationen zuerst die aktuelle `install-release.sh` wie oben
beschrieben als `/usr/local/lib/projekt-deploy/install-observability-release.sh`
installieren, dann das Monitoring-Release bereitstellen. Der Timer läuft alle sechs
Stunden um 00:30, 06:30, 12:30 und 18:30 UTC mit bis zu fünf Minuten Verzögerung.
Verpasste Termine werden beim Start nachgeholt. Für die erste Sicherung:

```sh
sudo systemctl start projekt-postgres-backup.service
sudo journalctl -u projekt-postgres-backup.service -n 40 --no-pager
sudo systemctl status projekt-postgres-backup.timer --no-pager
```

`pg_dumpall` im laufenden Container `projekt_postgres` sichert alle Datenbanken und
Rollen einschließlich Passwort-Hashes als komprimiertes SQL. Der lokale Socket
muss den Betriebssystembenutzer `postgres` ohne Passwort zulassen; andernfalls
bricht der Lauf ab. Die Client-Version entspricht dadurch der Server-Version.
Jede Datenbank wird konsistent gesichert; es gibt keinen gemeinsamen Snapshot über
mehrere Datenbanken und keine Wiederherstellung auf beliebige Zeitpunkte (WAL).

Bucket, Endpunkt, Region und versioniertes S3-Secret entsprechen exakt der
Log-Konfiguration (`LOKI_S3_*`, `OBS_SECRET_REVISION`). Es werden keine neuen
Zugangsdaten angelegt. Der Schlüssel benötigt Schreib- und Leserechte für
`projekt/production/postgres/`. Bucket-Lifecycle-Regeln prüfen: Das Werkzeug
löscht keine PostgreSQL-Objekte aus S3.

Lokale Archive liegen mit restriktiven Rechten in `/etc/projekt/postgres-backups`.
Nach erfolgreichem Upload und vollständigem SHA-256-Rücklesevergleich werden eigene
lokale Archive älter als 14 Tage entfernt. Bei Fehlern bleibt die lokale Kopie
liegen; Plattenplatz bei anhaltenden Fehlern überwachen. Der gemeinsame Deploy-Lock
verhindert Überschneidungen mit Deployment und Grafana-Sicherung. Grafana alarmiert
bei Fehlern sowie fehlender oder mehr als acht Stunden alter erfolgreicher Sicherung.

Für eine Wiederherstellung das gewünschte `.sql.gz` über einen autorisierten
S3-Client herunterladen und `gzip -t` ausführen. Einen isolierten, leeren
PostgreSQL-Server derselben Hauptversion mit einem separaten Bootstrap-Superuser
(z. B. `restore_admin`) starten. Das vermeidet den Konflikt mit der im Dump
enthaltenen Rolle `postgres`. Anschließend beispielsweise:

```sh
set -o pipefail
gzip -dc /sicherer/pfad/sicherung.sql.gz | docker exec -i --user postgres POSTGRES_TEST_CONTAINER psql -U restore_admin -d postgres -v ON_ERROR_STOP=1
```

Rollen, Tabellen und fachliche Daten prüfen, bevor die Anwendung auf die
wiederhergestellte Datenbank umgestellt wird. Das SQL niemals ungeprüft gegen die
laufende Produktionsdatenbank ausführen. Datenbank-Backups enthalten vertrauliche
Daten und Passwort-Hashes; Downloads entsprechend geschützt aufbewahren.

Der isolierte Wiederherstellungstest verwendet ausschließlich temporäre Container:
`python3 production/observability/test-postgres-integration.py`.
Zum Abschalten `sudo systemctl disable --now projekt-postgres-backup.timer` ausführen.


## Dashboard-Abgleich und Event Loop

Das provisionierte Dashboard heißt **Projekt – Betrieb und Diagnose**
(UID `projekt-production`). Es enthält **Node.js Event Loop p99** neben
**Node.js Heap**. Die Event-Loop-Metrik stammt von Next.js, nicht vom Browser.
Ein vollständig fehlendes Panel von einem Panel mit „No data“ unterscheiden:
Bei fehlendem Panel Dashboard-UID und bereitgestellte Konfiguration prüfen;
bei fehlenden Daten `nodejs_eventloop_lag_p99_seconds` in Prometheus und Thanos prüfen.

Die projektrelevanten Anzeigen der Vorlage sind übernommen. Elasticsearch,
Chat-Metriken und ein nicht vorhandener Anwendungs-Cron bleiben ausgenommen.
PostgreSQL- und Grafana-Sicherungen haben eigene Anzeigen; WebSocket-Dauer kann
Grafana Live erfassen und ist keine HTTP-Latenz. Ohne entsprechende abgeschlossene
Verbindungen bleibt diese Anzeige leer.

Der Alarm **Anhaltende Swap-Aktivität** reagiert auf mehr als 100 Speicherseiten/s
(Ein- plus Auslagerungen, Mittelwert über fünf Minuten), wenn dieser Zustand
fünf Minuten anhält. `FIRING` bedeutet, dass die Regel ausgelöst hat; es ist keine
Entwarnung und kein bloßer Versandtest. Einlagerungen nach Start oder Sicherung
können die Regel auslösen. Mit `vmstat 1 60`, verfügbarem RAM, Antwortzeiten und
I/O-Wartezeit bewerten; die erste vmstat-Zeile ist der Mittelwert seit Systemstart.
