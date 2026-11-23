#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_dir="$(cd "$script_dir/../../.." && pwd)"
compose=(docker compose --env-file "$app_dir/.env.local" -f "$script_dir/compose.dev.yml")

# Gemeinsame Infrastruktur wird separat betrieben; nur die eigene Anwendung verwalten.
"${compose[@]}" stop marketplace marketplace-nginx marketplace-haproxy
