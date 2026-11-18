# Eine Datenbank, getrennte Anwendungen

Alle Anwendungen verwenden dieselbe PostgreSQL-Datenbank. Jede Anwendung erhält
ein eigenes Schema und einen eigenen PostgreSQL-Benutzer:

| Anwendung | Datenbank | Schema | Datenbankbenutzer |
| --- | --- | --- | --- |
| Stellensuche | `postgres` | `stellensuche` | `stellensuche_app` |
| Beispiel einer weiteren Anwendung | `postgres` | `verwaltung` | `verwaltung_app` |

`User`, `InternalRole`, `JobListing` und alle weiteren Modelle der Stellensuche
liegen ausschließlich in `stellensuche`. Eine zweite Anwendung kann eigene,
auch gleichnamige Tabellen in ihrem Schema verwalten. Ihre Prisma-Modelle und
Migrationen bleiben in ihrem Anwendungsordner. Es wird keine weitere Datenbank
angelegt. Next.js und der Stellenimport gehören zur selben Anwendung und teilen
sich den Datenbankzugang.

Die Grenze erzwingt PostgreSQL mit Schema- und Objektrechten. `search_path` und
Prismas `schema`-Parameter wählen lediglich das Ziel; sie ersetzen keine Rechte.
Die Anwendungsbenutzer sind keine Superuser, Datenbankbesitzer oder Mitglieder
anderer Rollen. Sie dürfen nur im eigenen Schema Objekte verwalten. Migrationen
verwenden denselben Anwendungsbenutzer und benötigen kein `CREATE DATABASE`.
`prisma migrate deploy` ist der vorgesehene Ablauf; `migrate dev` benötigt eine
separate Entwicklungsumgebung beziehungsweise explizite Shadow-Datenbank.

PostgreSQL-Administratoren und Sicherungswerkzeuge behalten Zugriff auf alle
Schemas. Gemeinsame Systemkataloge können Objektnamen zeigen; die Trennung schützt
die Nutzung und Inhalte der Anwendungsobjekte, nicht die gesamte Metadatensicht.
Keine zusätzlichen gegenseitigen Grants oder Rollenmitgliedschaften vergeben.

## Einrichtung eines Schemas

`provision-app.sql` läuft als PostgreSQL-Superuser in der **bestehenden** Datenbank.
Der Schemaname wird als `app_schema` übergeben. Der Benutzername ergibt sich daraus
mit dem Suffix `_app`. Das Passwort kommt ausschließlich aus der Umgebungsvariable
`DATABASE_APP_PASSWORD`, mindestens 24 Zeichen. Für URLs sind zufällige
Hex-Passwörter praktisch, da keine zusätzliche URL-Kodierung nötig ist.

Die Einrichtung ist wiederholbar; sie setzt bei jedem Aufruf das angegebene
Passwort. Sie entzieht `PUBLIC` den Zugriff auf `public` und das Recht, Schemas in
der Datenbank anzulegen. Bestehende Anwendungen in `public` müssen deshalb vor
Einführung weiterer eingeschränkter Benutzer nach dem folgenden Ablauf umziehen.
Die Administratorrechte werden dadurch nicht entzogen.

Auf dem Rechner, auf dem PostgreSQL beziehungsweise der Container tatsächlich läuft,
aus dem Repository-Hauptordner in Bash ausführen. Container und Datenbanknamen bei
abweichender Installation anpassen; der Befehl muss genau einen Container finden:

```bash
postgres_container=$(sudo docker ps -q --filter label=com.docker.swarm.service.name=projekt_postgres --filter health=healthy)
test "$(printf '%s\n' "$postgres_container" | wc -l | tr -d ' ')" = 1 && test -n "$postgres_container"
sudo docker cp infrastructure/postgres "$postgres_container:/tmp/projekt-postgres"
read -r -s -p 'Neues Passwort für stellensuche_app: ' DATABASE_APP_PASSWORD
printf '\n'
export DATABASE_APP_PASSWORD
sudo --preserve-env=DATABASE_APP_PASSWORD docker exec --env DATABASE_APP_PASSWORD \
  "$postgres_container" psql -X -U postgres -d postgres \
  -v app_schema=stellensuche -f /tmp/projekt-postgres/provision-app.sql
unset DATABASE_APP_PASSWORD
```

Bei einer weiteren Anwendung nur den Schemanamen ersetzen und ein eigenes Passwort
verwenden. Keine Benutzer oder Schemas zwischen Anwendungen wiederverwenden.

## Bestehende Stellensuche aus public umziehen

Dieser Schritt ist eine einmalige Wartung auf dem Server und wird nicht durch
normale Prisma-Migrationen automatisch ausgelöst. Alte und neue Instanzen dürfen
während des Umzugs nicht gleichzeitig schreiben.

1. Alle bisherigen Prisma-Migrationen einschließlich
   `20261117110000_user_import_schedule` mit der bisherigen Konfiguration anwenden.
2. Aktuelle Sicherung prüfen. Die vorhandene PostgreSQL-Sicherung erfasst die
   gesamte Datenbank einschließlich Schemas und Rollen. Für eine zusätzliche
   Sicherung: `sudo /usr/local/lib/projekt-observability/current/storage-admin.sh postgres-backup`.
3. Stellensuche und Import im Wartungsfenster stoppen:
   `sudo docker service scale projekt_nextjs=0 projekt_jobs=0`.
4. `stellensuche` mit dem oben beschriebenen Administratoraufruf einrichten.
5. Im selben Container den transaktionalen Umzug ausführen:

```bash
sudo docker exec "$postgres_container" psql -X -U postgres -d postgres \
  -f /tmp/projekt-postgres/move-stellensuche.sql
```

Der Umzug erhält Tabelleninhalte, IDs, Sequenzen, Indizes, Fremdschlüssel, Enums
und `_prisma_migrations`. Unvollständige Bestände oder ein bereits belegtes
Zielschema werden abgewiesen. Ein erfolgreich abgeschlossener Umzug kann erneut
aufgerufen werden. Unbeteiligte Objekte in `public` werden nicht verschoben.
Die bisherigen Prisma-Migrationsdateien werden nicht geändert oder neu baselined.

6. Das `DATABASE_URL`-Secret der Stellensuche auf den neuen Benutzer und das Schema
   umstellen. Beispiel **ohne echtes Passwort**:

```dotenv
DATABASE_URL=postgresql://stellensuche_app:URL_KODIERTES_PASSWORT@projekt_postgres:5432/postgres?schema=stellensuche
```

   In der geschützten Next.js-Env-Datei nur diese URL ändern und den bestehenden
   Ablauf für eine neue Secret-/Runtime-Revision aus
   [production/README.md](../../production/README.md) verwenden. `POSTGRES_PASSWORD`
   bleibt das separate Administratorkennwort. Falls `jobs` bereits einen eigenen
   Secret-Verweis im Manifest hat, auch diesen auf dieselbe neue Datenbank-URL
   umstellen; sonst erbt der Resolver die Next.js-Einbindung. Keine Admin-URL in
   Anwendungscontainer übernehmen.
7. Mit der neuen Runtime-Konfiguration `migrate.sh` ausführen, anschließend über
   `deploy-stack.sh` wieder bereitstellen. Die Soll-Replikate und `start-first`
   bleiben in `production/compose.swarm.yml` definiert. Anmeldung, Stellen und
   Import prüfen. Der Schemaumzug erfordert kein Zurücksetzen der Benutzerpasswörter.

Vor dem Wiederanlauf lässt sich ein fehlgeschlagener SQL-Umzug dank Transaktion
wiederholen; bei erfolgreichem Umzug müssen die Zugangsdaten auf das neue Schema
zeigen. Ein Image-Rollback verschiebt keine Tabellen zurück. Bei Problemen zuerst
Konfiguration und Datenbankzustand prüfen, keine leeren Tabellen nach `public`
migrieren. Nach Abschluss die temporären SQL-Dateien aus dem Container entfernen:

```bash
sudo docker exec "$postgres_container" rm -rf -- /tmp/projekt-postgres
```

## Lokale Entwicklung und Tests

Die lokale Compose-Datei bindet die SQL-Werkzeuge schreibgeschützt ein. Bei einer
leeren Datenbank erstellt `init-stellensuche.sh` das Schema während der PostgreSQL-
Initialisierung. Für vorhandene Entwicklungsvolumes führt
`services/development/scripts/start_local_services.sh` die Einrichtung vor dem
Anwendungsstart aus. Zuerst vorhandene Migrationen im alten Schema abschließen.
Ein separat gestarteter Next.js-Prozess auf dem Host muss vorher beendet werden.

`STELLENSUCHE_DATABASE_PASSWORD` in der lokalen Compose-Env-Datei ist unabhängig
von `POSTGRES_PASSWORD`. `DATABASE_URL` für Host-Werkzeuge verwendet denselben
Anwendungsbenutzer, aber den Host `localhost` statt `postgres`.

```bash
npm run test:database:isolation
npm run test:db
npm run test:jobs:db
npm run test:registration:db
npm run test:db:down
```

Der Isolationstest verwendet einen kurzlebigen PostgreSQL-Container mit genau
einer Datenbank und simuliert den vollständigen Bestandsumzug. Er prüft die
Migrationshistorie, fortlaufende IDs, zwei getrennte Benutzer, gleichnamige Tabellen
und verweigerte Lese-, Schreib-, DDL-, Typ- und Rollenwechselzugriffe. Die normalen
Datenbanktests laufen ebenfalls als eingeschränkter `stellensuche_app`.

Grundlagen: [PostgreSQL-Schemas](https://www.postgresql.org/docs/17/ddl-schemas.html)
und [Prismas PostgreSQL-Verbindungsparameter](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql).
