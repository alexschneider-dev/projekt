#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
compose=(docker compose)
if [[ -f "$script_dir/.env.development.docker" ]]; then
  compose+=(--env-file "$script_dir/.env.development.docker")
fi
compose+=(-f "$script_dir/compose.dev.yml")

# Das gemeinsame Netzwerk kann bereits von einer Anwendung angelegt worden sein.
if ! docker network inspect nextjs_dev >/dev/null 2>&1; then
  docker network create nextjs_dev >/dev/null
fi
"${compose[@]}" up -d --no-build
