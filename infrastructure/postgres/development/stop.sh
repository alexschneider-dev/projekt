#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker compose --env-file "$script_dir/.env.development.docker" \
  -f "$script_dir/compose.dev.yml" stop postgres
