#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/../errors/development.sh"
case "${1:-}" in
  stellensuche|marketplace) app_schema="$1" ;;
  *) echo "$ERROR_DEVELOPMENT_SCHEMA" >&2; exit 1 ;;
esac

# Passwort nicht in Befehlsargumenten oder auf der Konsole anzeigen.
read -r -s -p "Passwort für ${app_schema}_app: " DATABASE_APP_PASSWORD
printf '\n'
if [[ ${#DATABASE_APP_PASSWORD} -lt 24 ]]; then
  echo "$ERROR_DEVELOPMENT_PASSWORD" >&2
  exit 1
fi
export DATABASE_APP_PASSWORD
trap 'unset DATABASE_APP_PASSWORD' EXIT
docker exec --env DATABASE_APP_PASSWORD postgres-projekt \
  psql -X -U postgres -d postgres -v "app_schema=$app_schema" \
  -f /opt/projekt-postgres/provision-app.sql
