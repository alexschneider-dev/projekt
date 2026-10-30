#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
python="${PYTHON:-python3}"
for file in *.sh; do bash -n "$file"; done
node --test config-revisions.test.mjs settings.test.mjs replace-s3-secrets.test.mjs
"$python" - <<'PY'
import json
from pathlib import Path
import yaml
for path in Path('.').rglob('*.yml'):
    yaml.safe_load(path.read_text())
json.loads(Path('grafana/overview.json').read_text())
PY
set -a
source settings.env.example
export OBS_S3_HOST=s3.example.com
set +a
export OBS_S3_SECRET_REVISION="${OBS_S3_SECRET_REVISION:-$OBS_SECRET_REVISION}"
revisions=$(node config-revisions.mjs)
while read -r key value; do export "$key=$value"; done <<< "$revisions"
docker stack config -c compose.swarm.yml >/dev/null
prom_image=$("$python" -c 'import yaml; print(yaml.safe_load(open("compose.swarm.yml"))["services"]["prometheus"]["image"])')
alloy_image=$("$python" -c 'import yaml; print(yaml.safe_load(open("compose.swarm.yml"))["services"]["alloy"]["image"])')
loki_image=$("$python" -c 'import yaml; print(yaml.safe_load(open("compose.swarm.yml"))["services"]["loki"]["image"])')
docker run --rm --entrypoint /bin/promtool -v "$PWD:/config:ro" "$prom_image" check config /config/prometheus.yml
docker run --rm -v "$PWD:/config:ro" "$alloy_image" validate --stability.level=public-preview /config/alloy.alloy
docker run --rm -e LOKI_S3_ENDPOINT=https://s3.example.com -e LOKI_S3_BUCKET=test -e LOKI_S3_REGION=test \
  -v "$PWD:/config:ro" "$loki_image" -config.file=/config/loki.yml -config.expand-env=true -verify-config=true
