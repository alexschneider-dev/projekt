#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Anwendungen und Proxy teilen dieses Netzwerk, aber keine Compose-Verwaltung.
if ! docker network inspect nextjs_dev >/dev/null 2>&1; then
  docker network create nextjs_dev >/dev/null
fi
docker compose --env-file "$script_dir/.env.development.docker" \
  -f "$script_dir/compose.dev.yml" up -d --wait postgres
