#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_dir="$(cd "$script_dir/../../.." && pwd)"
compose=(docker compose --env-file "$app_dir/.env.local" -f "$script_dir/compose.dev.yml")

# Gemeinsame Infrastruktur wird separat betrieben; nur die eigene Anwendung verwalten.
# Erst nach erfolgreicher Datenbankmigration und erreichbarer App Watch starten.
if ! "${compose[@]}" up -d --build --wait --wait-timeout 150; then
  "${compose[@]}" logs --tail=40 marketplace
  exit 1
fi
exec "${compose[@]}" watch --no-up marketplace
