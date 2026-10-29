#!/usr/bin/env bash
set -Eeuo pipefail
# Der CI-Benutzer ist wie bei Anwendungs-Releases ein vertrauenswürdiger Administrator.
[[ $# == 1 && "$1" =~ ^/tmp/projekt-observability\.[a-zA-Z0-9]+$ ]] || exit 1
source_dir=$1
[[ -d "$source_dir" && ! -L "$source_dir" ]] || exit 1
files=(
  deploy.sh
  check-health.sh
  check-health.py
  config-revisions.mjs
  settings.mjs
  compose.swarm.yml
  prometheus.yml
  loki.yml
  tempo.yml
  alloy.alloy
  exporters/swarm.py
  errors/messages.py
  errors/messages.sh
  errors/messages.mjs
  storage-admin.sh
  backup/postgres.py
  backup/projekt-postgres-backup.service
  backup/projekt-postgres-backup.timer
  backup/storage.py
  backup/snapshot.py
  backup/projekt-monitoring-backup.service
  backup/projekt-monitoring-backup.timer
  grafana/datasources.yml
  grafana/dashboards.yml
  grafana/alerting.yml
  grafana/overview.json
  grafana/error.html
)
for file in "${files[@]}"; do
  [[ -f "$source_dir/$file" && ! -L "$source_dir/$file" ]] || exit 1
done
for dir in grafana exporters backup errors; do [[ ! -L "$source_dir/$dir" ]] || exit 1; done
bash -n "$source_dir/deploy.sh"
bash -n "$source_dir/check-health.sh"
install -d -o root -g root -m 0700 /usr/local/lib/projekt-observability
release=$(mktemp -d /usr/local/lib/projekt-observability/release.XXXXXXXX)
install -d -m 0700 "$release/grafana" "$release/exporters" "$release/backup" "$release/errors"
for file in "${files[@]}"; do
  install -o root -g root -m 0600 "$source_dir/$file" "$release/$file"
done
printf 'Monitoring-Version: %s\n' "$release"
bash "$release/deploy.sh"
ln -sfn "$release" /usr/local/lib/projekt-observability/current
install -o root -g root -m 0644 "$release/backup/projekt-monitoring-backup.service" /etc/systemd/system/
install -o root -g root -m 0644 "$release/backup/projekt-monitoring-backup.timer" /etc/systemd/system/
install -o root -g root -m 0644 "$release/backup/projekt-postgres-backup.service" /etc/systemd/system/
install -o root -g root -m 0644 "$release/backup/projekt-postgres-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now projekt-monitoring-backup.timer
systemctl enable --now projekt-postgres-backup.timer
