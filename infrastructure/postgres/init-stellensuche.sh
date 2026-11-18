#!/usr/bin/env bash
set -Eeuo pipefail

# Nur im PostgreSQL-Container; die SQL-Dateien sind schreibgeschützt eingebunden.
DATABASE_APP_PASSWORD="$STELLENSUCHE_DATABASE_PASSWORD" \
  psql -X --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set app_schema=stellensuche --file /opt/projekt-postgres/provision-app.sql
psql -X --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --file /opt/projekt-postgres/move-stellensuche.sql
