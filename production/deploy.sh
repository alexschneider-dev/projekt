#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE="${1:-}"
VERSION="${2:-}"

if [[ -z "$SERVICE" || -z "$VERSION" ]]; then
  echo "Verwendung:"
  echo "  ./deploy.sh nextjs 13.29"
  echo "  ./deploy.sh nginx 4.61"
  exit 1
fi

case "$SERVICE" in
  nextjs)
    SWARM_SERVICE="projekt_nextjs"
    IMAGE="ghcr.io/alexschneider-dev/projekt"
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
# Vor der Bereitstellung abbrechen, falls der ausgewählte Service nicht existiert.
docker service inspect "$SWARM_SERVICE" >/dev/null

umask 077
work_dir=$(mktemp -d)
trap 'rm -rf -- "$work_dir"' EXIT

# Hier nur die Basis-YAML normalisieren. Docker lehnt leere JSON-Secret-Listen
# mit --skip-interpolation ab; die Laufzeitkonfiguration erst danach ergänzen.
# Für andere Services werden bei der Auswahl keine Image-Variablen benötigt.
docker stack config --skip-interpolation \
  -c compose.swarm.yml > "$work_dir/all.yml"
node - "$SERVICE" "$work_dir" "${IMAGE}:${VERSION}" "$RUNTIME" <<'NODE'
const fs = require("node:fs");
const [service, directory, image, runtimePath] = process.argv.slice(2);
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
      keep = match[1] === service;
      if (keep) found++;
    }
    if (keep) selected.push(line);
  } else {
    selected.push(line);
  }
}
if (sections !== 1 || found !== 1) throw new Error("Ausgewählter Service fehlt oder ist nicht eindeutig");
fs.writeFileSync(`${directory}/service.yml`, selected.join("\n"));
// Laufzeitkonfiguration vor dem Zusammenführen auswählen, auch ohne Secrets.
const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
fs.writeFileSync(`${directory}/runtime.json`, JSON.stringify({
  ...runtime, services: { [service]: runtime.services?.[service] || {} },
}));
// Das angegebene Release-Image hat Vorrang vor Basis- und Laufzeitkonfiguration.
fs.writeFileSync(`${directory}/image.json`, JSON.stringify({
  version: "3.9", services: { [service]: { image } },
}));
NODE

# Nach dem Filtern bleibt nur der Image-Platzhalter des ausgewählten Service übrig.
key="$(printf '%s' "$SERVICE" | tr '[:lower:]' '[:upper:]')_IMAGE"
export "$key=${IMAGE}:${VERSION}"
docker stack config -c "$work_dir/service.yml" -c "$work_dir/runtime.json" -c "$work_dir/image.json" >/dev/null
docker pull "${IMAGE}:${VERSION}"
# Niemals --prune ergänzen: Alle anderen projekt-Services fehlen hier absichtlich.
docker stack deploy --detach=false --with-registry-auth --resolve-image always \
  -c "$work_dir/service.yml" -c "$work_dir/runtime.json" -c "$work_dir/image.json" projekt

# Laufende Tasks können vor Ende der Swarm-Überwachungsphase konvergieren.
# Deshalb bis zu fünf Minuten auf den endgültigen Update-Status warten.
for ((attempt=0; attempt<150; attempt++)); do
  STATE=$(docker service inspect "$SWARM_SERVICE" \
    --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}')
  [[ "$STATE" == "updating" ]] || break
  sleep 2
done
ACTUAL_IMAGE=$(docker service inspect "$SWARM_SERVICE" \
  --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
if [[ "$STATE" == "updating" ]]; then
  echo "Zeitlimit überschritten: $SWARM_SERVICE wird weiterhin aktualisiert." >&2
  exit 1
fi
if [[ "${ACTUAL_IMAGE%%@*}" != "${IMAGE}:${VERSION}" || ( -n "$STATE" && "$STATE" != "completed" ) ]]; then
  echo "Deployment nicht erfolgreich (Status: $STATE); möglicher Rollback." >&2
  exit 1
fi
echo "Deployment erfolgreich: ${SERVICE} ${VERSION}"
docker service ps "$SWARM_SERVICE"
