#!/usr/bin/env bash
set -Eeuo pipefail

TAG="${1:-}"
if [[ ! "$TAG" =~ ^[0-9]+\.[0-9]+$ ]]; then
  echo "Bitte Migration-Tag angeben, z. B. 1.02"
  exit 1
fi

IMAGE="ghcr.io/alexschneider-dev/projekt-migration:${TAG}"
NEXT_CONTAINERS=$(docker ps \
  --filter "label=com.docker.swarm.service.name=projekt_nextjs" \
  --filter "status=running" --format '{{.ID}}')
NEXT_CONTAINER="${NEXT_CONTAINERS%%$'\n'*}"
if [[ -z "$NEXT_CONTAINER" ]]; then
  echo "Kein laufender Next.js-Container auf diesem Server gefunden"
  exit 1
fi

DATABASE_URL=$(docker exec "$NEXT_CONTAINER" printenv DATABASE_URL)
if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_URL fehlt"
  exit 1
fi
export DATABASE_URL

echo "Prüfe Image: $IMAGE"
docker pull "$IMAGE"

CONTAINER="projekt-migration-$(cat /proc/sys/kernel/random/uuid)"
cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Migration gestartet ..."

timeout --signal=TERM --kill-after=15s 240s \
  docker run --rm --name "$CONTAINER" \
    --network projekt_net --env DATABASE_URL "$IMAGE"

echo "Migration erfolgreich"
