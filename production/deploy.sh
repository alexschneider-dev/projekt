#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE="${1:-}"
VERSION="${2:-}"

if [[ -z "$SERVICE" || -z "$VERSION" ]]; then
  echo "Verwendung:"
  echo "  ./deploy.sh nextjs 13.29"
  echo "  ./deploy.sh nginx 4.61"
  echo "  ./deploy.sh jobs 13.29"
  exit 1
fi

case "$SERVICE" in
  nextjs)
    SWARM_SERVICE="projekt_nextjs"
    IMAGE="ghcr.io/alexschneider-dev/projekt"
    ;;
  jobs)
    SWARM_SERVICE="projekt_jobs"
    IMAGE="ghcr.io/alexschneider-dev/projekt-jobs"
    ;;
  marketplace)
    SWARM_SERVICE="projekt_marketplace"
    IMAGE="ghcr.io/alexschneider-dev/projekt-marketplace"
    ;;
  marketplace-websocket)
    SWARM_SERVICE="projekt_marketplace-websocket"
    IMAGE="ghcr.io/alexschneider-dev/projekt-marketplace-websocket"
    ;;
  nginx)
    SWARM_SERVICE="projekt_nginx"
    IMAGE="ghcr.io/alexschneider-dev/nginx-projekt"
    ;;
  *)
    echo "Unbekannter Service: $SERVICE"
    exit 1
    ;;
esac

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+$ ]]; then
  echo "Ungültige Version" >&2
  exit 1
fi

# Gemeinsame Sperre für Service- und Stack-Bereitstellungen auf dem Manager.
exec 9>/var/lock/projekt-deploy.lock
flock -w 900 9

cd "$(dirname "$0")"
RUNTIME=/etc/projekt/runtime.json
[[ -s "$RUNTIME" ]] || { echo "Datei fehlt oder ist leer: $RUNTIME" >&2; exit 1; }
# Bestehende Services prüfen; der Importservice darf hier erstmals angelegt werden.
if [[ "$SERVICE" != "jobs" && "$SERVICE" != "marketplace" && "$SERVICE" != "marketplace-websocket" ]]; then
  docker service inspect "$SWARM_SERVICE" >/dev/null
fi

umask 077
work_dir=$(mktemp -d)
trap 'rm -rf -- "$work_dir"' EXIT
node runtime-overlay.mjs "$RUNTIME" "$work_dir/runtime.json" "$SERVICE"

# Hier nur die Basis-YAML normalisieren. Docker lehnt leere JSON-Secret-Listen
# mit --skip-interpolation ab; die Laufzeitkonfiguration erst danach ergänzen.
# Für andere Services werden bei der Auswahl keine Image-Variablen benötigt.
docker stack config --skip-interpolation \
  -c compose.swarm.yml > "$work_dir/all.yml"
node - "$SERVICE" "$work_dir" "${IMAGE}:${VERSION}" <<'NODE'
const fs = require("node:fs");
const [
  service,
  directory,
  image
] = process.argv.slice(2);
const app = service === "nextjs" ? "stellensuche" : service === "marketplace" ? "marketplace" : null;
const services = app ? [service, `${app}-nginx`, `${app}-haproxy`] : [service];
const release = image.slice(image.lastIndexOf(":") + 1);
const images = Object.fromEntries(services.map(name => [name, {
  image: name === service ? image : `ghcr.io/alexschneider-dev/projekt-${name}:${release}`,
}]));
const lines = fs.readFileSync(`${directory}/all.yml`, "utf8").split("\n");
let inServices = false, keep = false, found = 0, sections = 0;
const selected = [];
for (const line of lines) {
  if (/^services:\s*$/.test(line)) {
    inServices = true;
    sections++;
    selected.push(line);
    continue;
  }
  if (/^\S/.test(line)) inServices = false;
  if (inServices) {
    // Dies ist die von Docker normalisierte YAML. Bei einem geänderten
    // Format der Service-Zuordnung sicherheitshalber abbrechen.
    if (/^  \S/.test(line)) {
      const match = /^  ([a-zA-Z0-9_-]+):\s*$/.exec(line);
      if (!match) throw new Error("Unerwartetes Format der Docker-Service-Zuordnung");
      keep = services.includes(match[1]);
      if (keep) found++;
    }
    if (keep) selected.push(line);
  } else {
    selected.push(line);
  }
}
if (sections !== 1 || found !== services.length) throw new Error("Ausgewählter Service fehlt oder ist nicht eindeutig");
fs.writeFileSync(`${directory}/service.yml`, selected.join("\n"));
// Das angegebene Release-Image hat Vorrang vor Basis- und Laufzeitkonfiguration.
fs.writeFileSync(`${directory}/image.json`, JSON.stringify({
  version: "3.9", services: images,
}));
NODE

# Nach dem Filtern bleibt nur der Image-Platzhalter des ausgewählten Service übrig.
key="$(printf '%s' "$SERVICE" | tr '[:lower:]-' '[:upper:]_')_IMAGE"
export "$key=${IMAGE}:${VERSION}"
docker stack config -c "$work_dir/service.yml" -c "$work_dir/runtime.json" -c "$work_dir/image.json" >/dev/null
docker pull "${IMAGE}:${VERSION}"
# Niemals --prune ergänzen: Alle anderen projekt-Services fehlen hier absichtlich.
docker stack deploy --detach=false --with-registry-auth --resolve-image always \
  -c "$work_dir/service.yml" -c "$work_dir/runtime.json" -c "$work_dir/image.json" projekt

# Auch die app-eigenen Proxys müssen ihr Release ohne Rollback erreichen.
services=("$SERVICE")
case "$SERVICE" in
  nextjs) services+=(stellensuche-nginx stellensuche-haproxy) ;;
  marketplace) services+=(marketplace-nginx marketplace-haproxy) ;;
esac
for ((attempt=0; attempt<150; attempt++)); do
  pending=false
  for deployed_service in "${services[@]}"; do
    state=$(docker service inspect "projekt_${deployed_service}" \
      --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}')
    case "$state" in
      updating) pending=true ;;
      ""|completed) ;;
      *) echo "Deployment nicht erfolgreich: $deployed_service ($state)." >&2; exit 1 ;;
    esac
  done
  [[ "$pending" == true ]] || break
  sleep 2
done
if [[ "$pending" == true ]]; then
  echo "Zeitlimit überschritten: Die Anwendung oder ihre Proxys werden weiterhin aktualisiert." >&2
  exit 1
fi
for deployed_service in "${services[@]}"; do
  expected="${IMAGE}:${VERSION}"
  if [[ "$deployed_service" != "$SERVICE" ]]; then
    expected="ghcr.io/alexschneider-dev/projekt-${deployed_service}:${VERSION}"
  fi
  actual=$(docker service inspect "projekt_${deployed_service}" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
  if [[ "${actual%%@*}" != "$expected" ]]; then
    echo "Deployment nicht erfolgreich: $deployed_service verwendet ein anderes Image." >&2
    exit 1
  fi
done
echo "Deployment erfolgreich: ${SERVICE} ${VERSION}"
docker service ps "$SWARM_SERVICE"
