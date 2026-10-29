#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
source errors/messages.sh
settings="${1:-/etc/projekt/observability.env}"
[[ -r "$settings" ]] || { echo "$OBS_SETTINGS_ERROR" >&2; exit 1; }
set -a
source "$settings"
set +a
node --input-type=module -e 'import {validateSettings} from "./settings.mjs"; validateSettings(process.env);'
export OBS_S3_HOST="${LOKI_S3_ENDPOINT#https://}"
OBS_S3_HOST="${OBS_S3_HOST%/}"
exec 9>/var/lock/projekt-deploy.lock
flock -w 900 9
revisions=$(node config-revisions.mjs)
while read -r key value; do export "$key=$value"; done <<< "$revisions"
for name in grafana_admin_password smtp_password postgres_password loki_s3_credentials thanos_s3; do
  docker secret inspect "projekt_obs_${name}_${OBS_SECRET_REVISION}" >/dev/null
done
docker network inspect projekt_net >/dev/null
docker volume inspect projekt_monitoring_backup >/dev/null
network=$(docker network inspect projekt_grafana_proxy --format '{{.Driver}} {{range .IPAM.Config}}{{.Subnet}}{{end}}')
[[ "$network" == 'overlay 10.254.0.0/24' ]] || { echo "$OBS_NETWORK_ERROR" >&2; exit 1; }
node=$(docker node ls --filter node.label=observability=true --format '{{.ID}}')
local_node=$(docker info --format '{{.Swarm.NodeID}}')
[[ "$node" == "$local_node" ]] || { echo "$OBS_NODE_ERROR" >&2; exit 1; }
docker stack config -c compose.swarm.yml >/dev/null
docker stack deploy --detach=false --with-registry-auth --resolve-image changed -c compose.swarm.yml observability
for service in $(docker stack services observability --format '{{.Name}}'); do
  state=$(docker service inspect "$service" --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}')
  case "$state" in ''|completed) ;; *) echo "$OBS_DEPLOY_ERROR $service: $state" >&2; exit 1 ;; esac
done
bash check-health.sh
