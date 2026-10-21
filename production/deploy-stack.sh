#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
exec 9>/var/lock/projekt-deploy.lock
flock -w 900 9

RUNTIME=/etc/projekt/runtime.json
[[ -s "$RUNTIME" ]] || { echo "Zuerst $RUNTIME vorbereiten." >&2; exit 1; }

# Die Image-Versionen aus Swarm sind maßgeblich. Eine Konfigurationsänderung
# darf eine vorherige unabhängige Service-Bereitstellung nicht zurücksetzen.
for service in nextjs nginx postgres redis; do
  image=$(docker service inspect "projekt_${service}" \
    --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
  [[ -n "$image" ]] || exit 1
  key="$(printf '%s' "$service" | tr '[:lower:]' '[:upper:]')_IMAGE"
  export "$key=$image"
done

docker stack config -c compose.swarm.yml -c "$RUNTIME" >/dev/null
docker stack deploy --detach=false --resolve-image never --with-registry-auth \
  -c compose.swarm.yml -c "$RUNTIME" projekt

for service in nextjs nginx postgres redis; do
  state=$(docker service inspect "projekt_${service}" \
    --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}')
  case "$state" in
    ""|completed) ;;
    *) echo "Stack-Bereitstellung fehlgeschlagen: $service ($state)" >&2; exit 1 ;;
  esac
done
