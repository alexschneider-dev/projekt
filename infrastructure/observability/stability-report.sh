#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
source errors/messages.sh
hours=${1:-6}
[[ "$hours" =~ ^[0-9]+$ ]] && (( hours >= 1 && hours <= 72 )) || { echo "$OBS_REPORT_USAGE_ERROR" >&2; exit 1; }
echo 'Service-Repliken'
docker service ls --format 'table {{.Name}}\t{{.Replicas}}\t{{.Image}}'
echo 'Aktueller Ressourcenverbrauch'
free -h
df -h /
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'
echo 'Container-Historie einschließlich älterer Deployments'
for id in $(docker ps -aq --filter label=com.docker.stack.namespace=observability --filter label=com.docker.swarm.service.name); do
  docker inspect "$id" --format '{{.Name}} | Status={{.State.Status}} | Exit={{.State.ExitCode}} | OOM={{.State.OOMKilled}} | Start={{.State.StartedAt}} | End={{.State.FinishedAt}}'
done
id=$(docker ps -q --filter label=com.docker.swarm.service.name=observability_swarm-exporter --filter status=running)
[[ -n "$id" && "$id" != *$'\n'* ]] || { echo "$OBS_REPORT_CONTAINER_ERROR" >&2; exit 1; }
docker exec -i "$id" python - "$hours" < stability-report.py

# Ausgabe und Laufzeit pro Container begrenzen.
pattern='(^|[[:space:]])level=(warn|warning|error|fatal|panic)([[:space:]]|$)|"level"[[:space:]]*:[[:space:]]*"(warn|warning|error|fatal|panic)"|\[(warn|error|crit|alert|emerg)\]|(^|[[:space:]])(WARNING|ERROR|FATAL|PANIC):|^Traceback|^Error:'
echo 'Warnungen und Fehler: maximal 10.000 Zeilen pro Container, letzte 40 Treffer'
for stack in projekt observability; do
  for id in $(docker ps -aq --filter "label=com.docker.stack.namespace=$stack"); do
    docker inspect "$id" --format '{{.Name}}'
    log=$(mktemp)
    if timeout 20s docker logs --since "${hours}h" --tail 10000 "$id" >"$log" 2>&1; then
      count=$(grep -Eic "$pattern" "$log" || true)
      printf 'Verdächtige Zeilen: %s (begrenzte Suche; keine Treffer beweisen keine Fehlerfreiheit)\n' "$count"
      grep -Ei "$pattern" "$log" | tail -40 || true
    else
      echo "$OBS_REPORT_LOG_ERROR"
    fi
    rm -f "$log"
  done
done
