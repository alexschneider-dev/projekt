#!/usr/bin/env bash
set -Eeuo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

COMPOSE_FILE="$SCRIPT_DIR/compose.dev.yml"
ENV_FILE="$PROJECT_DIR/.env.local"

cd "$PROJECT_DIR"

COLIMA_MEMORY="${COLIMA_MEMORY:-6}"
COLIMA_CPU="${COLIMA_CPU:-5}"

if ! colima status >/dev/null 2>&1; then
  echo "Colima wird gestartet..."

  colima start \
    --memory "$COLIMA_MEMORY" \
    --cpu "$COLIMA_CPU"
fi

echo "Docker-Compose-Dienste werden gestartet..."

# PostgreSQL und Anwendungsrollen werden separat über die Infrastruktur eingerichtet.

if ! docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile dev \
  up -d --build --wait --wait-timeout 150; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=40 nextjs-projekt
  exit 1
fi

echo "✅ Container gestartet; Compose Watch läuft anschließend in diesem Terminal."
echo "Website: https://localhost/stellensuche (gemeinsamen Nginx separat starten)"

# Compose Watch synchronisiert Quellcode und führt konfigurierte Neubauten aus.
exec docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile dev \
  watch --no-up
