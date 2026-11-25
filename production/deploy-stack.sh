#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
exec 9>/var/lock/projekt-deploy.lock
flock -w 900 9

RUNTIME=/etc/projekt/runtime.json
[[ -s "$RUNTIME" ]] || { echo "Zuerst $RUNTIME vorbereiten." >&2; exit 1; }

# Die Laufzeitdatei darf keine Betriebsparameter aus Compose überschreiben.
umask 077
work_dir=$(mktemp -d)
trap 'rm -rf -- "$work_dir"' EXIT
node runtime-overlay.mjs "$RUNTIME" "$work_dir/runtime.json"

# Die Image-Versionen aus Swarm sind maßgeblich. Eine Konfigurationsänderung
# darf eine vorherige unabhängige Service-Bereitstellung nicht zurücksetzen.
for service in nextjs nginx postgres redis; do
  image=$(docker service inspect "projekt_${service}" \
    --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
  [[ -n "$image" ]] || exit 1
  key="$(printf '%s' "$service" | tr '[:lower:]' '[:upper:]')_IMAGE"
  export "$key=$image"
done

# Beim ersten Import-Deployment dasselbe Release wie Next.js verwenden.
if docker service inspect projekt_jobs >/dev/null 2>&1; then
  JOBS_IMAGE=$(docker service inspect projekt_jobs --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
else
  nextjs_release="${NEXTJS_IMAGE%%@*}"
  JOBS_IMAGE="ghcr.io/alexschneider-dev/projekt-jobs:${nextjs_release##*:}"
fi
export JOBS_IMAGE

# Der Marketplace ist erst nach expliziter Runtime-Einrichtung Teil des Stacks.
marketplace_enabled=$(node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync(process.argv[1])); process.stdout.write(r.services?.marketplace ? "true" : "false")' "$RUNTIME")
if [[ "$marketplace_enabled" == "true" ]]; then
  MARKETPLACE_IMAGE=$(docker service inspect projekt_marketplace --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
  export MARKETPLACE_IMAGE
fi
for app in stellensuche marketplace; do
  if [[ "$app" == "marketplace" && "$marketplace_enabled" != "true" ]]; then continue; fi
  for proxy in nginx haproxy; do
    image=$(docker service inspect "projekt_${app}-${proxy}" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
    key="$(printf '%s_%s' "$app" "$proxy" | tr '[:lower:]' '[:upper:]')_IMAGE"
    export "$key=$image"
  done
done
websocket_enabled=$(node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync(process.argv[1])); process.stdout.write(r.services?.["marketplace-websocket"] ? "true" : "false")' "$RUNTIME")
if [[ "$websocket_enabled" == "true" ]]; then
  MARKETPLACE_WEBSOCKET_IMAGE=$(docker service inspect projekt_marketplace-websocket --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
  export MARKETPLACE_WEBSOCKET_IMAGE
fi
docker stack config --skip-interpolation -c compose.swarm.yml > "$work_dir/base.yml"
if [[ "$marketplace_enabled" != "true" || "$websocket_enabled" != "true" ]]; then
  node - "$work_dir/base.yml" "$marketplace_enabled" "$websocket_enabled" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const lines = fs.readFileSync(file, "utf8").split("\n");
let inServices = false;
let skip = false;
const selected = [];
for (const line of lines) {
  if (/^services:\s*$/.test(line)) inServices = true;
  else if (/^\S/.test(line)) { inServices = false; skip = false; }
  if (inServices && /^  \S/.test(line)) skip = (process.argv[3] !== "true" && /^  marketplace(?:-nginx|-haproxy)?:\s*$/.test(line))
    || (process.argv[4] !== "true" && /^  marketplace-websocket:\s*$/.test(line));
  if (!skip) selected.push(line);
}
fs.writeFileSync(file, selected.join("\n"));
NODE
fi

# Edge behält ebenfalls sein laufendes Image. Geänderte HAProxy-Inhalte erhalten
# einen neuen Config-Namen, weil Swarm Configs unveränderlich sind.
EDGE_IMAGE=$(docker service inspect projekt-edge_edge --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
[[ -n "$EDGE_IMAGE" ]] || exit 1
# 20 Zeichen Präfix plus 40 Hash-Zeichen bleiben unter Dockers Grenze von 64 Zeichen.
EDGE_CONFIG_NAME="projekt_edge_haproxy_$(node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(require("node:fs").readFileSync("edge-haproxy.cfg")).digest("hex").slice(0, 40))')"
export EDGE_IMAGE EDGE_CONFIG_NAME

docker stack config -c compose.edge.yml >/dev/null
docker stack config -c "$work_dir/base.yml" -c "$work_dir/runtime.json" >/dev/null
docker stack deploy --detach=false --resolve-image never --with-registry-auth \
  -c compose.edge.yml projekt-edge
docker stack deploy --detach=false --resolve-image never --with-registry-auth \
  -c "$work_dir/base.yml" -c "$work_dir/runtime.json" projekt

# Konvergierte Tasks bedeuten noch nicht, dass die Überwachungsphase beendet ist.
# Für den gesamten Stack höchstens fünf Minuten auf den Abschluss warten.
for ((attempt=0; attempt<150; attempt++)); do
  pending=false
  services=(projekt_nextjs projekt_jobs projekt_nginx projekt_postgres projekt_redis projekt-edge_edge projekt_stellensuche-nginx projekt_stellensuche-haproxy)
  if [[ "$marketplace_enabled" == "true" ]]; then services+=(projekt_marketplace projekt_marketplace-nginx projekt_marketplace-haproxy); fi
  if [[ "$websocket_enabled" == "true" ]]; then services+=(projekt_marketplace-websocket); fi
  for service in "${services[@]}"; do
    state=$(docker service inspect "$service" \
      --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}')
    case "$state" in
      ""|completed) ;;
      updating) pending=true ;;
      *) echo "Stack-Bereitstellung fehlgeschlagen: $service ($state)" >&2; exit 1 ;;
    esac
  done
  if [[ "$pending" == false ]]; then
    echo "Stack-Bereitstellung erfolgreich."
    exit 0
  fi
  sleep 2
done
echo "Zeitlimit überschritten: Der Stack wird weiterhin aktualisiert." >&2
exit 1
