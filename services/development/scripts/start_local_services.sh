#!/usr/bin/env bash
set -Eeuo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

COMPOSE_FILE="$SCRIPT_DIR/compose.dev.yml"
ENV_FILE="$SCRIPT_DIR/.env.development.docker"

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

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile dev \
  up -d --build

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile dev \
  ps

echo "✅ Container gestartet; Next.js wird im Protokollfenster vorbereitet."
echo "Website: https://localhost"

# Compose Watch bleibt während der Entwicklung im Protokollfenster aktiv.
# Synchronisierte Dateien lösen Turbopack ohne Neustart von Next.js aus.
LOGS_CMD="cd '$PROJECT_DIR' && docker compose --env-file '$ENV_FILE' -f '$COMPOSE_FILE' --profile dev up --watch --menu=false --no-deps nextjs-projekt"
STATS_CMD="cd '$PROJECT_DIR' && docker stats --all --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'"

export LOGS_CMD STATS_CMD
TERM_MARKER="PROJEKT_MONITOR"
export TERM_MARKER

# 1) Zuerst die Terminal-Fenster öffnen, damit VS Code den Fokus nicht stört.

osascript <<'EOF'
on ensureMonitor(tabTitle, commandText)
  tell application "Terminal"
    set targetTab to missing value
    repeat with candidateWindow in windows
      repeat with candidateTab in tabs of candidateWindow
        if custom title of candidateTab is tabTitle then
          set targetTab to contents of candidateTab
          exit repeat
        end if
      end repeat
      if targetTab is not missing value then exit repeat
    end repeat

    if targetTab is missing value then
      -- Ohne Ziel öffnet Terminal ein Fenster und startet den Befehl direkt.
      set targetTab to do script commandText
      set custom title of targetTab to tabTitle
    else if not (busy of targetTab) then
      -- Keine Eingaben an einen laufenden Watch- oder Statistikprozess senden.
      do script commandText in targetTab
    end if
  end tell
end ensureMonitor

set logsCmd to system attribute "LOGS_CMD"
set statsCmd to system attribute "STATS_CMD"
set marker to system attribute "TERM_MARKER"

my ensureMonitor(marker & " LOGS", logsCmd)
my ensureMonitor(marker & " STATS", statsCmd)
tell application "Terminal" to activate
EOF

# 2) VS Code nach den Terminal-Fenstern öffnen.
osascript <<EOF
set projectDir to "$PROJECT_DIR"

tell application "Visual Studio Code"
  activate
  open POSIX file projectDir
end tell
EOF


osascript <<'EOF'
set urlToOpen to "https://localhost/"

tell application "Google Chrome"
  if not (it is running) then
    launch
    delay 0.5
  end if
  activate

  if (count of windows) = 0 then
    make new window
  end if

  tell front window
    -- Aktuellen Tab wiederverwenden.
    set URL of active tab to urlToOpen
  end tell
end tell
EOF
