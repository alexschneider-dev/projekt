#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
source errors/messages.sh
for ((attempt=1; attempt<=12; attempt++)); do
  replicas=$(docker stack services observability --format '{{.Name}} {{.Replicas}}')
  if [[ -n "$replicas" ]] && awk '
    { split($2, n, "/"); if (n[1] != n[2] || n[2] == 0) bad=1; count++ }
    END { exit (bad || count != 15) }
  ' <<< "$replicas"; then
    id=$(docker ps -q --filter label=com.docker.swarm.service.name=observability_swarm-exporter --filter status=running)
    if [[ -n "$id" && "$id" != *$'\n'* ]] && docker exec -i "$id" python - < check-health.py; then
      echo 'Alle Monitoring-Prüfungen sind erfolgreich.'
      exit 0
    fi
  fi
  echo "Warte auf betriebsbereite Monitoring-Dienste ($attempt/12)..."
  sleep 10
done
docker stack services observability
echo "$OBS_HEALTH_ERROR" >&2
exit 1
