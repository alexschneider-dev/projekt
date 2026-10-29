#!/usr/bin/env bash
set -Eeuo pipefail

# Einmalig durch einen Administrator installieren. CI darf nur die aufgeführten
# Dateien aktualisieren; dieser Installer und sudoers werden nicht übertragen.
if [[ $# != 1 || ! "$1" =~ ^/tmp/projekt-deploy\.[a-zA-Z0-9]+$ ]]; then
  echo "Ein Verzeichnis im Format /tmp/projekt-deploy.XXXXXXXX wird erwartet" >&2
  exit 1
fi
source_dir="$1"
destination=/usr/local/lib/projekt-deploy
[[ -d "$source_dir" && ! -L "$source_dir" ]] || exit 1
scripts=(deploy.sh deploy-stack.sh migrate.sh)
files=(compose.swarm.yml runtime-overlay.mjs compose.edge.yml edge-haproxy.cfg)
for file in "${scripts[@]}" "${files[@]}"; do
  [[ -f "$source_dir/$file" && ! -L "$source_dir/$file" ]] || exit 1
done
exec 9>/var/lock/projekt-deploy.lock
flock -w 900 9
for file in "${scripts[@]}"; do
  bash -n "$source_dir/$file"
done
for file in "${scripts[@]}"; do
  install -o root -g root -m 0755 "$source_dir/$file" "$destination/$file.new"
  mv -f "$destination/$file.new" "$destination/$file"
done
for file in "${files[@]}"; do
  install -o root -g root -m 0644 "$source_dir/$file" "$destination/$file.new"
  mv -f "$destination/$file.new" "$destination/$file"
done
