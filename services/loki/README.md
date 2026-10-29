# Loki 3.6.18: Abbruch beim Vorladen von Chunks

Das Image `ghcr.io/alexschneider-dev/projekt-loki:3.6.18-projekt.1` baut den festen
Upstream-Commit `c969f5cf4b4ca6073d29e0a74b236f4d05d7b79a`. Das Quellarchiv
wird per SHA-256 geprüft. Der Patch ändert ausschließlich die Log-Ausgabe an
zwei Stellen: `parallel_chunk_fetch.go` und `fetcher.go`.

Nur wenn sowohl `ctx.Err()` als auch der zurückgegebene, gegebenenfalls
umhüllte Fehler `context.Canceled` sind, wird auf Debug statt Error geloggt.
Bei der üblichen Info-Logstufe erscheinen diese Meldungen deshalb nicht mehr.
Die Rückgabewerte, Fehlerweitergabe, S3-Anfragen und Abbruchlogik bleiben
unverändert. `DeadlineExceeded`, Berechtigungsfehler und Netzwerkfehler bleiben
Error, auch wenn gleichzeitig der Kontext abgebrochen wird. Dieser Patch
unterscheidet nicht zwischen Ergebnislimit und anderen Kontext-Abbrüchen;
beide sind auf Debug weiterhin nachvollziehbar. Er behebt keine Netzstörung.

## Build und Auslieferung

`docker build -t ghcr.io/alexschneider-dev/projekt-loki:3.6.18-projekt.1 services/loki`

Der Build führt die Go-Tests der drei betroffenen Pakete aus, einschließlich
Regressionstest für den parallelen Chunk-Fetcher und negativer Kontrollen.
Der bestehende Observability-Workflow baut das Image, verwendet es für die
Loki-Integrationstests und veröffentlicht es erst nach erfolgreichen Prüfungen
bei einem manuellen Lauf auf `main`. Ein Deployment erfolgt nur bei gesetzter Eingabe `deploy`.
Pull Requests veröffentlichen und deployen nichts. Der Produktionsbuild ist
Linux/amd64 (wie die bestehenden Produktionsimages).

Der Server braucht Lesezugriff auf das neue GHCR-Paket `projekt-loki`: entweder ist
das Paket öffentlich oder der bestehende Docker-Login unter root hat Zugriff.
`deploy.sh` reicht Registry-Zugangsdaten an Swarm weiter. Der Loki-Patch selbst
erfordert kein Anwendungs-Deployment. Die separat übernommene Proxy-Korrektur
erfordert ein neues Nginx-Image. Loki läuft einmal;
sein Austausch kann Log-Abfragen kurz unterbrechen.

Künftige Änderungen benötigen einen neuen Image-Tag in der Compose-Datei
und im Workflow. Für einen Rückbau dort wieder `grafana/loki:3.6.18` verwenden
und den Custom-Build/-Push im Workflow entfernen. Es gibt keine Schema- oder
Speichermigration. Der separate Alloy-Diagnosefilter bleibt unabhängig davon.

Vor der ersten Serverinstallation den Workflow **Monitoring prüfen und bereitstellen**
auf `main` mit `deploy=false` ausführen. Dadurch steht das geprüfte Image für die
spätere Installation bereit. Keine Builds auf dem 2-GB-Produktionsserver ausführen.
