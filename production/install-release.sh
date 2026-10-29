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
for file in "${scripts[@]}" compose.swarm.yml runtime-overlay.mjs; do
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
install -o root -g root -m 0644 "$source_dir/compose.swarm.yml" "$destination/compose.swarm.yml.new"
mv -f "$destination/compose.swarm.yml.new" "$destination/compose.swarm.yml"

install -o root -g root -m 0644 "$source_dir/runtime-overlay.mjs" "$destination/runtime-overlay.mjs.new"
mv -f "$destination/runtime-overlay.mjs.new" "$destination/runtime-overlay.mjs"
