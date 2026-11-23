#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
compose=(docker compose)
if [[ -f "$script_dir/.env.development.docker" ]]; then
  compose+=(--env-file "$script_dir/.env.development.docker")
fi
compose+=(-f "$script_dir/compose.dev.yml")

"${compose[@]}" stop nginx edge
