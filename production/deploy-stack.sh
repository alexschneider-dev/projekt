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

docker stack config -c compose.swarm.yml -c "$work_dir/runtime.json" >/dev/null
docker stack deploy --detach=false --resolve-image never --with-registry-auth \
  -c compose.swarm.yml -c "$work_dir/runtime.json" projekt

# Konvergierte Tasks bedeuten noch nicht, dass die Überwachungsphase beendet ist.
# Für den gesamten Stack höchstens fünf Minuten auf den Abschluss warten.
for ((attempt=0; attempt<150; attempt++)); do
  pending=false
  for service in nextjs nginx postgres redis; do
    state=$(docker service inspect "projekt_${service}" \
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
