#!/usr/bin/env bash
set -Eeuo pipefail

TAG="${1:?Bitte Migration-Tag angeben, z. B. 13.37}"

SERVICE="projekt_migration"
IMAGE="ghcr.io/alexschneider-dev/projekt-migration:${TAG}"
NETWORK="projekt_net"

cleanup() {
  docker service rm "$SERVICE" >/dev/null 2>&1 || true
}

if [[ ! "$TAG" =~ ^[0-9]+\.[0-9]+$ ]]; then
  echo "Ungültiger Migration-Tag" >&2
  exit 1
fi
exec 9>/var/lock/projekt-deploy.lock
flock -w 900 9

DATABASE_SECRET=$(docker service inspect projekt_nextjs --format \
  '{{range .Spec.TaskTemplate.ContainerSpec.Secrets}}{{if eq .File.Name "runtime_DATABASE_URL"}}{{.SecretName}}{{end}}{{end}}')
ENTRYPOINT_CONFIG=$(docker service inspect projekt_nextjs --format \
  '{{range .Spec.TaskTemplate.ContainerSpec.Configs}}{{if eq .File.Name "/production-entrypoint.sh"}}{{.ConfigName}}{{end}}{{end}}')
if [[ -z "$DATABASE_SECRET" || -z "$ENTRYPOINT_CONFIG" ]]; then
  echo "Zuerst Produktion auf Swarm Secrets umstellen." >&2
  exit 1
fi

echo "Prüfe Image: $IMAGE"
docker pull "$IMAGE"

cleanup
trap cleanup EXIT

docker service create \
  --detach \
  --name "$SERVICE" \
  --network "$NETWORK" \
  --restart-condition none \
  --secret "source=$DATABASE_SECRET,target=runtime_DATABASE_URL" \
  --config "source=$ENTRYPOINT_CONFIG,target=/production-entrypoint.sh" \
  --entrypoint /bin/sh \
  --with-registry-auth \
  "$IMAGE" /production-entrypoint.sh ./node_modules/.bin/prisma migrate deploy >/dev/null

echo "Migration gestartet ..."

for _ in $(seq 1 120); do
  STATE=$(docker service ps "$SERVICE" \
    --format '{{.CurrentState}}' \
    | head -n 1)

  case "$STATE" in
    Complete*)
      docker service logs "$SERVICE"
      echo "✅ Migration erfolgreich"
      exit 0
      ;;

    Failed*|Rejected*|Orphaned*)
      docker service logs "$SERVICE" || true
      echo "❌ Migration fehlgeschlagen: $STATE"
      exit 1
      ;;

    *)
      sleep 2
      ;;
  esac
done

docker service logs "$SERVICE" || true
echo "❌ Migration hat das Zeitlimit überschritten"
exit 1
