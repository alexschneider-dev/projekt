# Gemeinsamer WebSocket-Server

Ein separater Socket.IO-Prozess als npm-Workspace `marketplace-websocket` im
Marketplace. Installation und Lockdatei gehören zu `apps/marketplace`; im
Workspace keine zweite Lockdatei anlegen. Der öffentliche Namespace `/statistics`
liefert derzeit verfügbare Produkte und aktive Verkäuferkonten an alle Besucher.
Der Footer zeigt die Werte unter **Live · Echtzeit** auf jeder Seite an.

## Datenfluss

1. Ein angemeldeter, berechtigter Aufrufer ändert ein Angebot oder Verkäuferkonto
   über die API. Die Anwendung prüft Origin, Rolle, Eingaben und Angebotsbesitz.
2. Die Anwendung serialisiert relevante Änderungen in einer PostgreSQL-Transaktion
   über dieselbe Advisory Lock. Nur hier werden die beiden Zähler berechnet.
3. Nach dem Commit schreibt die Anwendung einen vollständigen Snapshot nach Redis
   und veröffentlicht ihn atomar per Lua. Die Transaktionsrevision verhindert,
   dass verspätete Veröffentlichungen einen neueren Snapshot überschreiben.
4. Der WebSocket-Server abonniert Redis und sendet den Snapshot an `/statistics`.
   Nach einem Neustart oder Redis-Reconnect liest er den letzten Redis-Snapshot.
   Neue Browser bekommen sofort den aktuell bekannten Snapshot.
5. Beim Start prüft die Next.js-Anwendung einmal den Redis-Snapshot. Fehlt er,
   liest sie unter derselben Transaktionssperre die Ausgangswerte aus PostgreSQL
   und veröffentlicht sie. Bei vorhandenem Snapshot erfolgt keine Datenbankzählung.

Der WebSocket-Server hat **keinen Datenbankzugang und keinen Datenbanktreiber**.
Es gibt keinen periodischen Datenbankabgleich, kein Browser-Polling und keinen
Socket.IO-Long-Polling-Fallback. Client und Server erlauben nur `websocket`.
Ping/Pong zur Verbindungsprüfung bleibt Teil des WebSocket-Protokolls.

- Produkt: veröffentlicht und mindestens ein aktives Angebot mit `stock > 0`.
  Mehrere Angebote desselben Produkts zählen einmal. Ein deaktiviertes
  Verkäuferkonto deaktiviert nicht automatisch dessen Angebote.
- Verkäufer: verknüpftes Benutzerkonto mit `active = true` und Rolle `SELLER`.
  Die zwölf Demo-Verkäufer werden mit aktiven Konten angelegt und zählen mit.
- Die Startinitialisierung stellt auch ohne vorherige API-Änderung einen echten
  Zählerstand bereit. Ist Redis oder die Datenbank dabei nicht erreichbar, bleibt
  die Anwendung nutzbar; der Footer zeigt einen Verfügbarkeitshinweis. Ein erneuter
  Anwendungsstart oder eine erfolgreiche API-Änderung kann den Stand bereitstellen.
- Bei einem fehlgeschlagenen Redis-Publish bleibt die Datenbankänderung gültig;
  die Änderungs-APIs melden `realtimeUpdated: false`. Die nächste erfolgreiche
  Änderung berechnet beide Zähler vollständig neu. Es gibt derzeit keine
  garantierte Ereigniszustellung über eine persistente Outbox. Ein verlorener
  Publish kann deshalb bis zur nächsten erfolgreichen Änderung alte Werte zeigen.
- Direkte SQL-/Seed-/CLI-Änderungen umgehen die Veröffentlichung. Demo-Skripte
  sollen die nachstehenden APIs verwenden. Redis speichert den letzten Snapshot;
  ohne Redis-Persistenz muss er nach einem vollständigen Redis-Verlust durch eine
  erneute API-Änderung oder einen Neustart der Anwendung aufgebaut werden.

## APIs für Skripte

Die bestehende NextAuth-Anmeldung mit E-Mail und Passwort liefert das Session-Cookie.
Skripte behalten dieses Cookie und senden den passenden `Origin`-Header sowie
`Content-Type: application/json`. Kein API-Schlüssel oder öffentlicher Schreibzugriff.

| Methode und Pfad (inklusive Standard-basePath) | Berechtigung | JSON-Body |
| --- | --- | --- |
| `PATCH /marketplace/api/seller/offers/{offerId}/availability` | `SELLER`, ausschließlich eigene Angebote | `{"active":true,"stock":5}` |
| `PATCH /marketplace/api/admin/sellers/{sellerId}/status` | `SUPER_ADMIN`, nur vorhandene Verkäuferkonten | `{"active":true}` |
| `POST /marketplace/api/admin/demo-products` | `SUPER_ADMIN` | kein Body; erzeugt 1.000 Demoprodukte |

Der Verkäuferstatus betrifft das gesamte Benutzerkonto. Die Änderung erhöht
`sessionVersion` und widerruft bestehende Sessions; Rollen werden nicht geändert.
Die Verfügbarkeits- und Status-APIs liefern `success` und `realtimeUpdated`.
Ein identisches erneutes PATCH eignet sich zum Wiederaufbau des Snapshots,
bevor Besucher die Demo öffnen.

## Lokale Ausführung

Alle npm-Befehle im Ordner `apps/marketplace` ausführen:

```sh
npm ci
npm run websocket:test
npm run websocket:start
```

Der Server benötigt `REDIS_URL` und `WEBSOCKET_ORIGIN` (exakte Browser-Origin,
z. B. `https://localhost`). Optional: `PORT=3010`, `BASE_PATH=/marketplace`.
Die Anwendung benötigt ebenfalls `REDIS_URL`. Keine Zugangsdaten in `NEXT_PUBLIC_*`.
`GET /health` prüft die Redis-Verbindung und Subscription; ein noch nicht
initialisierter Zähler verhindert nicht den Serverstart.

`npm run dev:services` startet auch den WebSocket-Workspace und einen privaten
lokalen Redis-Container. Die Images vorher mit `docker compose --env-file .env.local
-f services/development/scripts/compose.dev.yml build` bauen. Nginx leitet `/marketplace/socket.io/` an den neuen
Server weiter. Nach Änderungen am Server erneut ausführen:

```sh
docker compose --env-file .env.local -f services/development/scripts/compose.dev.yml up -d --build marketplace-websocket
```

Die Integrationstests verwenden ausschließlich isolierte lokale Dienste:

```sh
docker compose -f services/websocket/testing/compose.yml up -d --wait
npm run websocket:test:integration
docker compose -f services/websocket/testing/compose.yml down -v
```

Der Redis-Test verwendet Port `56381` und leert ausschließlich diese Testinstanz.
Der zusätzliche Anwendungstest `testing/statistics-database.test.ts` wird nur mit
seinen exakt festgelegten lokalen Test-URLs ausgeführt. Er prüft die echten
PostgreSQL-Schreibvorgänge und den Redis-Snapshot nach parallelen Änderungen.

## Produktionsbereitstellung durch den Betreiber

Betriebsparameter stehen in `production/compose.swarm.yml`. Der Dienst wird bei
Stack-Updates nur berücksichtigt, wenn `runtime.json` einen Eintrag
`marketplace-websocket` enthält. Die bestehende Bereitstellung unterstützt:

```sh
# Im Repository-Hauptordner; die Release-Version selbst festlegen.
VERSION=1.00
docker build -f apps/marketplace/services/websocket/Dockerfile \
  -t ghcr.io/alexschneider-dev/projekt-marketplace-websocket:$VERSION apps/marketplace
docker push ghcr.io/alexschneider-dev/projekt-marketplace-websocket:$VERSION
```

Auf dem Server manuell die Runtime-Einbindungen entsprechend
`production/runtime-keys.json` vorbereiten:

- `marketplace`: zusätzlich Secret `REDIS_URL`.
- `marketplace-websocket`: Secret `REDIS_URL`, öffentliche Variable
  `WEBSOCKET_ORIGIN=https://<eigene-domain>`, `BASE_PATH=/marketplace`, `PORT=3010`
  sowie dieselbe versionierte `/production-entrypoint.sh`-Config wie bei den
  übrigen Node-Diensten. **Kein `DATABASE_URL` für diesen Dienst.**
- Beide Redis-URLs müssen dieselbe Redis-Datenbank verwenden. Redis bleibt im
  internen Netz; nur Nginx nimmt öffentliche Verbindungen an.
- Bei Nutzung von `prepare-config.mjs` ist `marketplace-websocket.env` optional;
  nur eine tatsächlich bereitgestellte Datei aktiviert die neue Runtime-Sektion.

Nach Bereitstellung des Images und der Runtime-Konfiguration auf dem Server:

```sh
sudo /usr/local/lib/projekt-deploy/deploy.sh marketplace-websocket 1.00
```

Zusätzlich Marketplace und seine Nginx-Version sowie den gemeinsamen Nginx mit
den geänderten Proxy-Regeln ausrollen. Der Dienst veröffentlicht keinen eigenen
Host-Port. TLS endet am vorhandenen HTTPS-Nginx; Browser verwenden dadurch WSS.
Es wurden keine Serververbindungen oder Produktionsänderungen ausgeführt.

## Spätere private Kunden-/Verkäuferfunktionen

`/statistics` ist ausdrücklich öffentlich und transportiert ausschließlich
Zähler, Version und Revision. Der Standard-Namespace ist gesperrt. Weitere
Namespaces dürfen erst nach eigener serverseitiger Sessionprüfung freigegeben
werden; Räume und Empfänger sind aus geprüften Berechtigungen abzuleiten.
Ein Namespace allein ist keine Autorisierung. Keine privaten Ereignisse über
`io.emit()` oder den Statistikkanal senden.

WSS verschlüsselt den Transport. Ende-zu-Ende-Verschlüsselung benötigt zusätzlich
Schlüsselverwaltung auf den Endgeräten und ist noch nicht implementiert.
Mehrere WebSocket-Replikate können den öffentlichen Redis-Kanal unabhängig
abonnieren; für spätere private Räume wäre ein passender verteilter Adapter nötig.
