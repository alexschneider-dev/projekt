# Container-Sicherheitsprüfung

Die gemeinsame Action `.github/actions/audit-image` verwendet Trivy 0.76.2 mit
`aquasecurity/trivy-action@v0.36.0`. Alle Schweregrade und auch noch nicht behobene
Befunde blockieren standardmäßig. Scannerfehler bleiben immer blockierend.
`report-only` ist als ausdrücklich zu setzende Option vorhanden; kein
Projekt-Workflow aktiviert diese Ausnahme.

Vor jedem Scan wird der alte Bericht entfernt. Die Zusammenfassung enthält
höchstens 200.000 UTF-8-Bytes; der vollständige Bericht bleibt im Job-Protokoll
und für 30 Tage als Artefakt erhalten. Artefaktnamen unterscheiden Job,
Laufversuch und Image, damit mehrere Scans in einem Release nicht kollidieren.

Alle App-, Migrations-, Stellenimport-, Nginx-, HAProxy- und Loki-Releases bauen
mit frischem Basisimage ohne Build-Cache und prüfen vor dem Push. Die täglichen
Prüfungen verwenden zusätzlich ein frisches Inventar der tatsächlich laufenden
Produktionsimages. Ein neuer Build ist kein Nachweis über laufende Container.

## Einmalige manuelle Server-Vorbereitung

Die neue Inventarprüfung und die Inventaraufnahme nach Deployments benötigen
einen root-eigenen Exporter. Ein Administrator führt im aktuellen Checkout auf
dem Server einmalig aus; `DEPLOY_BENUTZER` durch den bestehenden CI-Benutzer ersetzen:

```sh
sudo bash infrastructure/security/install-exporter.sh DEPLOY_BENUTZER
sudo /usr/local/lib/projekt-audit/export-audit-images.py
```

Der Installer gewährt ausschließlich diesen argumentlosen Lesebefehl über sudo.
Er überträgt keine Umgebungsvariablen, Secrets oder vollständigen Docker-Specs.
Die bestehenden GitHub-Secrets der Umgebung `Production` werden verwendet.
Der Agent führt diese Server-Befehle nicht aus.

`projekt`, `projekt-edge` und `observability` müssen vollständig laufen.
Während eines Rollouts oder bei fehlenden Tasks schlägt die Inventaraufnahme
fehl und muss nach Abschluss erneut gestartet werden. Tag-Verweise werden
nur aus dem tatsächlichen lokalen Container aufgelöst, nie aus einem inzwischen
veränderten Registry-Tag. Bei verteilten, ungepinnten Tasks ist eine manuelle
Digest-Festlegung erforderlich.

Der tägliche und der manuelle Audit auf dem Default-Branch speichern einen
frischen Snapshot als Artefakt und prüfen jeden Digest genau einmal.
Wiederverwendete Test-/Release-Aufrufe überspringen die Produktionsinventur
standardmäßig, damit neue Sicherheitsreleases unabhängig vom alten
Produktionszustand gebaut werden können. Pull Requests benötigen keine
Produktionszugänge. Es werden keine fremden oder erfundenen Produktions-Digests
als Referenzinventar eingecheckt.

Ein manuell exportiertes Inventar kann lokal geprüft und importiert werden:

```sh
python3 infrastructure/security/image-audit.py \
  --import-export /tmp/deployed-images.txt \
  --inventory /tmp/deployed-images.json
```

`required-services.json` enthält alle Dienste der drei Compose-Dateien. Bei
Änderungen am Dienstbestand muss die Liste mitgeändert werden; Tests prüfen
die Übereinstimmung. Unvollständige Exporte überschreiben kein Inventar.

## Eigene Sicherheitsimages

`build-security-images.yml` baut HAProxy, Redis, Python, Prometheus, cAdvisor,
Tempo, Thanos und vier Exporter. Quellen, Prüfsummen und Basis-Digests stammen
aus den geprüften Buildvorlagen. Go-Abhängigkeiten werden gezielt aktualisiert.
Prometheus behält seine eingebetteten Oberflächen; cAdvisor behält libpfm.
Thanos benötigt zwingend `slicelabels`, damit die Protobuf-Konvertierung mit den
aktualisierten Prometheus-Labels kompatibel bleibt. Seine Patchdateien enthalten
Upstream-Code und Moduländerungen einschließlich der ursprünglichen Lizenzen.

Die Builds führen Upstream-Tests und anschließend isolierte Funktionsprüfungen
aus, etwa OTLP-Schreiben/Lesen bei Tempo und PromQL-Abfragen bei Thanos.
Erst nach strengem Trivy-Scan werden die Images bei manuellem Workflow-Aufruf
auf `main` veröffentlicht. Pull Requests veröffentlichen nichts.

Die Observability-Compose-Datei wählt die korrigierten Prometheus-, cAdvisor-,
Tempo-, Thanos-, Python- und Exporter-Images aus dieser Build-Matrix aus.
**Zuerst muss „Infrastruktur – Sicherheitsimages bauen“ auf `main` erfolgreich
fertig sein.** Erst danach kann der Observability-Workflow diese Images laden,
integriert testen und bei bestandener Sicherheitsprüfung bereitstellen.
Die ausgewählten Tags sind keine Bestätigung über bereits laufende Container.

Grafana und Alloy verwenden neuere offizielle, per Digest festgelegte Releases.
Auch diese können weiterhin Befunde haben. Die experimentellen Ersatzbuilds
werden wegen offener Sicherheits- und Laufzeitprobleme nicht übernommen.
PostgreSQL bleibt unverändert; ein Datenbankwechsel benötigt einen gesondert
geprüften Sicherungs-/Wiederherstellungsablauf. Keine dieser offenen Komponenten
wird durch `report-only`, niedrigere Schweregrade oder Ignore-Regeln freigestellt.

Der Loki-Releasepfad baut Version 3.6.22 mit dem bestehenden Abbruch-Logpatch.
Anwendungs-Releases bauen ihre Images neu; Laufzeitimages enthalten keine
ungenutzten globalen npm-/Yarn-Installationen. Stellensuche und Import verwenden
nun dieselbe Alpine-Basis in Build und Laufzeit, einschließlich OpenSSL für Prisma.

### Befunde des Produktionslaufs vom 23. November 2026

Der bereitgestellte Lauf prüfte 26 Dienste, gruppiert in 23 Image-Scans.
20 Image-Scans hatten Sicherheitsbefunde; die drei Nginx-Scans waren sauber.
Inventar und npm-Prüfungen bestanden. Details stehen in
[der Auswertung](reports/2026-11-23-produktionsaudit.json).

Ein erneuter Audit desselben laufenden Digests repariert kein Image. Nach einem
sauberen Build muss das jeweilige Image über den vorgesehenen Releaseweg
bereitgestellt werden. Erst der folgende Live-Audit prüft den neuen Stand.
Der Stack-Konfigurationsworkflow bewahrt die bestehenden Edge- und Redis-Images;
diese beiden Dienste benötigen nach erfolgreichem Build ein gezieltes manuelles
Image-Update. Die Images heißen `projekt-haproxy:3.2.27-projekt.1` und
`projekt-redis:7.4.12-projekt.1` unter `ghcr.io/alexschneider-dev/`.

## Lokale Prüfungen

```sh
python3 -B -m unittest discover -s infrastructure/security/testing -p 'test_*.py'
node --test infrastructure/security/testing/workflows.test.mjs
node --test apps/stellensuche/testing/production-workflows.test.mjs
```

Die Docker-Funktionsprüfungen unter `testing/*-image-smoke.py` benötigen die
jeweils fertig gebauten Images. Sie verwenden synthetische Daten und isolierte
Container ohne Produktionszugänge. Vollständige Hersteller-Builds sind zusätzlich
im neuen CI-Workflow verpflichtend; lokale Tests ersetzen sie nicht.
