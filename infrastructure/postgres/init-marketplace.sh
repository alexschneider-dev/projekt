#!/usr/bin/env bash
set -Eeuo pipefail

# Vorhandenes PostgreSQL-Provisioning verwendet eigene Rechte und eigenes Schema.
DATABASE_APP_PASSWORD="${MARKETPLACE_DATABASE_PASSWORD:?}" \
  psql -X --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set app_schema=marketplace --file /opt/projekt-postgres/provision-app.sql
