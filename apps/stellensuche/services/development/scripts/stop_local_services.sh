#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_dir="$(cd "$script_dir/../../.." && pwd)"

# Gemeinsame Datenbank, Nginx und Docker bleiben für andere Anwendungen verfügbar.
docker compose --env-file "$app_dir/.env.local" \
  -f "$script_dir/compose.dev.yml" --profile dev --profile jobs stop nextjs-projekt jobs stellensuche-nginx stellensuche-haproxy
