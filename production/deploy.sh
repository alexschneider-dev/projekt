#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE="${1:-}"
VERSION="${2:-}"

if [[ -z "$SERVICE" || -z "$VERSION" ]]; then
  echo "Verwendung:"
  echo "  ./deploy.sh projekt 1.00"
  echo "  ./deploy.sh nginx-projekt 1.00"
  exit 1
fi

case "$SERVICE" in
  nextjs)
    ENV_KEY="PROJEKT_VERSION"
    SWARM_SERVICE="projekt"
    IMAGE="ghcr.io/alexschneider-dev/projekt"
    ;;
  nginx)
    ENV_KEY="NGINX_VERSION"
    SWARM_SERVICE="nginx-projekt"
    IMAGE="ghcr.io/alexschneider-dev/nginx-projekt"
    ;;
  *)
    echo "Unbekannter Service: $SERVICE"
    exit 1
    ;;
esac

cd "$(dirname "$0")"

if [[ ! -f versions.env ]]; then
  echo "versions.env wurde nicht gefunden."
  exit 1
fi

if [[ ! -f compose.swarm.yml ]]; then
  echo "compose.swarm.yml wurde nicht gefunden."
  exit 1
fi

if ! grep -q "^${ENV_KEY}=" versions.env; then
  echo "${ENV_KEY} fehlt in versions.env"
  exit 1
fi

if ! docker service inspect "$SWARM_SERVICE" >/dev/null 2>&1; then
  echo "Swarm-Service ${SWARM_SERVICE} wurde nicht gefunden."
  exit 1
fi

CURRENT_IMAGE=$(docker service inspect "$SWARM_SERVICE" \
  --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')

if [[ "$CURRENT_IMAGE" == "${IMAGE}:${VERSION}"* ]]; then
  echo "${SERVICE} ${VERSION} läuft bereits. Kein Deployment nötig."
  exit 0
fi

echo "Prüfe Image: ${IMAGE}:${VERSION}"
docker pull "${IMAGE}:${VERSION}"

OLD_VERSION=$(grep "^${ENV_KEY}=" versions.env | cut -d= -f2-)

sed -i "s/^${ENV_KEY}=.*/${ENV_KEY}=${VERSION}/" versions.env

set -a
. ./versions.env
set +a

echo "Prüfe Stack-Konfiguration..."

if ! docker stack config -c compose.swarm.yml >/dev/null; then
  sed -i "s/^${ENV_KEY}=.*/${ENV_KEY}=${OLD_VERSION}/" versions.env
  echo "Stack-Konfiguration ungültig. versions.env wurde zurückgesetzt."
  exit 1
fi

echo "Deploye ${SERVICE} ${VERSION}..."

if ! docker service update \
  --with-registry-auth \
  --image "${IMAGE}:${VERSION}" \
  "$SWARM_SERVICE"; then

  sed -i "s/^${ENV_KEY}=.*/${ENV_KEY}=${OLD_VERSION}/" versions.env

  echo "Deployment fehlgeschlagen."
  echo "versions.env wurde auf ${OLD_VERSION} zurückgesetzt."
  exit 1
fi

echo
echo "Deployment erfolgreich."
echo
docker service ps "$SWARM_SERVICE"