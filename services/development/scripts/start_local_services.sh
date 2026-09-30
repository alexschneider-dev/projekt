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
STARTUP_TIMEOUT="${STARTUP_TIMEOUT:-300}"

if [[ ! "$STARTUP_TIMEOUT" =~ ^[1-9][0-9]*$ ]]; then
  echo "❌ STARTUP_TIMEOUT muss eine positive Anzahl Sekunden sein." >&2
  exit 1
fi

for tool in colima docker curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "❌ $tool wurde nicht gefunden." >&2
    exit 1
  fi
done

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
  up -d

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  --profile dev \
  ps

echo "Warte bis zu ${STARTUP_TIMEOUT} Sekunden auf https://localhost/..."
STARTUP_DEADLINE=$((SECONDS + STARTUP_TIMEOUT))
while true; do
  REMAINING=$((STARTUP_DEADLINE - SECONDS))
  if (( REMAINING <= 0 )); then
    echo "❌ Die Website ist nach ${STARTUP_TIMEOUT} Sekunden noch nicht bereit." >&2
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile dev \
      logs --tail=50 nextjs-projekt nginx >&2 || true
    exit 1
  fi

  REQUEST_TIMEOUT=5
  if (( REMAINING < REQUEST_TIMEOUT )); then
    REQUEST_TIMEOUT=$REMAINING
  fi

  # Nur für das lokale Entwicklungszertifikat die Zertifikatsprüfung überspringen.
  if HTTP_STATUS=$(curl --silent --insecure --noproxy '*' \
    --connect-timeout "$REQUEST_TIMEOUT" --max-time "$REQUEST_TIMEOUT" \
    --output /dev/null --write-out '%{http_code}' https://localhost/); then
    if [[ "$HTTP_STATUS" == "200" ]]; then
      break
    fi
  fi
  sleep 1
done

echo "✅ Entwicklungsumgebung gestartet; Website ist erreichbar."
echo "Website: https://localhost"

LOGS_CMD="cd '$PROJECT_DIR' && docker logs --tail=500 -f nextjs-projekt"
STATS_CMD="cd '$PROJECT_DIR' && docker stats --all --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'"

export LOGS_CMD STATS_CMD
TERM_MARKER="MONITOR"
export TERM_MARKER

# 1) ZUERST das Terminal-Fenster zur Überwachung öffnen bzw. in den Vordergrund holen
#    (verhindert, dass VS Code den Fokus übernimmt)

osascript <<'EOF'
set logsCmd to system attribute "LOGS_CMD"
set statsCmd to system attribute "STATS_CMD"
set marker to system attribute "TERM_MARKER"

tell application "Terminal" to activate
delay 0.4

tell application "System Events"
  set termProc to process "Terminal"
  set frontmost of termProc to true
  delay 0.3

  -- Sicherstellen, dass Terminal im Vordergrund ist (ein erneuter Versuch bei Fokusproblemen mit Electron/VS Code)
  set frontApp to name of first application process whose frontmost is true
  if frontApp is not "Terminal" then
    tell application "Terminal" to activate
    delay 0.5
    set frontApp to name of first application process whose frontmost is true
    if frontApp is not "Terminal" then return
  end if

  -- Vorhandenes Überwachungsfenster anhand der Titelmarkierung finden
  set winIndex to 0
  repeat with i from 1 to count of windows of termProc
    try
      set t to name of window i of termProc
      if t contains marker then
        set winIndex to i
        exit repeat
      end if
    end try
  end repeat

  if winIndex is 0 then
    keystroke "n" using command down
    delay 0.4

    tell application "Terminal"
      do script "printf '\\e]0;" & marker & "\\a'" in selected tab of front window
    end tell
    delay 0.2

    keystroke "t" using command down
    delay 0.4
  else
    perform action "AXRaise" of window winIndex of termProc
    delay 0.3
  end if

  -- Tab 1 (Protokolle)
  keystroke "1" using command down
  delay 0.2
end tell

tell application "Terminal"
  do script "printf '\\033c\\n'; " & logsCmd in selected tab of front window
end tell

tell application "System Events"
  set termProc to process "Terminal"
  set frontmost of termProc to true
  delay 0.2

  -- Tab 2 (Statistiken)
  keystroke "2" using command down
  delay 0.2
end tell

tell application "Terminal"
  do script "printf '\\033c\\n'; " & statsCmd in selected tab of front window
end tell
EOF

# 2) VS Code NACH dem Terminal-Fenster öffnen (verhindert einen Fokuswechsel durch Electron während des Skriptablaufs)
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
    -- Aktuellen Tab wiederverwenden, statt einen neuen zu erstellen
    set URL of active tab to urlToOpen
  end tell
end tell
EOF
