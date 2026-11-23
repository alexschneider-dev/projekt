#!/usr/bin/env bash
set -Eeuo pipefail

TAG="${1:?Bitte Migration-Tag angeben, z. B. 13.37}"

SERVICE="projekt_migration"
IMAGE="ghcr.io/alexschneider-dev/projekt-migration:${TAG}"
NETWORK="projekt_net"
APPLICATION="${2:-nextjs}"
case "$APPLICATION" in
  nextjs) ;;
  marketplace)
    SERVICE="projekt_marketplace_migration"
    IMAGE="ghcr.io/alexschneider-dev/projekt-marketplace-migration:${TAG}"
    ;;
  *) exit 1 ;;
esac

cleanup() {
  docker service rm "$SERVICE" >/dev/null 2>&1 || true
}

if [[ ! "$TAG" =~ ^[0-9]+\.[0-9]+$ ]]; then
  echo "Ungültiger Migration-Tag" >&2
  exit 1
fi
exec 9>/var/lock/projekt-deploy.lock
flock -w 900 9

cd "$(dirname "$0")"
umask 077
runtime_copy=$(mktemp)
trap 'rm -f -- "$runtime_copy"' EXIT
node runtime-config.mjs /etc/projekt/runtime.json "$runtime_copy" "$APPLICATION"
DATABASE_SECRET=$(node -e 'const fs = require("node:fs"); const r = JSON.parse(fs.readFileSync(process.argv[1])); console.log(r.secrets[`${process.argv[2]}_DATABASE_URL`].name)' "$runtime_copy" "$APPLICATION")
ENTRYPOINT_CONFIG=$(node -e 'const fs = require("node:fs"); const r = JSON.parse(fs.readFileSync(process.argv[1])); const c = r.services[process.argv[2]].configs.find(c => c.target === "/production-entrypoint.sh"); console.log(r.configs[c.source].name)' "$runtime_copy" "$APPLICATION")

echo "Prüfe Image: $IMAGE"
docker pull "$IMAGE"

cleanup
trap 'cleanup; rm -f -- "$runtime_copy"' EXIT

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
