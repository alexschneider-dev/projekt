#!/usr/bin/env bash
set -Eeuo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/compose.dev.yml"
ENV_FILE="$SCRIPT_DIR/.env.development.docker"

echo "Entwicklungsumgebung wird gestoppt..."
STOP_STATUS=0

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker wurde nicht gefunden."
  echo "PATH=$PATH"
  STOP_STATUS=1
elif ! docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile dev \
  --profile test \
  down; then
  echo "⚠️ Docker Compose konnte nicht vollständig gestoppt werden. Die weiteren Schritte werden trotzdem ausgeführt." >&2
  STOP_STATUS=1
fi

if command -v colima >/dev/null 2>&1; then
  if colima status >/dev/null 2>&1; then
    echo "Colima wird gestoppt..."
    if ! colima stop; then
      echo "⚠️ Colima konnte nicht gestoppt werden." >&2
      STOP_STATUS=1
    fi
  else
    echo "Colima ist bereits gestoppt."
  fi
fi

if (( STOP_STATUS == 0 )); then
  echo "✅ Entwicklungsumgebung erfolgreich gestoppt."
else
  echo "⚠️ Beenden mit Fehlern abgeschlossen. Bitte die Meldungen oben prüfen." >&2
fi


exit "$STOP_STATUS"