#!/usr/bin/env bash
# Einmalig manuell durch einen Server-Administrator ausführen.
set -Eeuo pipefail
[[ $EUID -eq 0 && $# -eq 1 && "$1" =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 1
deploy_user=$1
id "$deploy_user" >/dev/null
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
target_dir=/usr/local/lib/projekt-audit
install -o root -g root -m 0755 -d "$target_dir/errors"
install -o root -g root -m 0755 "$source_dir/export-audit-images.py" "$target_dir/export-audit-images.py"
install -o root -g root -m 0644 "$source_dir/errors/messages.py" "$target_dir/errors/messages.py"

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
# Nur diesen Befehl ohne Argumente erlauben.
printf '%s ALL=(root) NOPASSWD: %s ""\n' "$deploy_user" "$target_dir/export-audit-images.py" > "$tmp"
visudo -cf "$tmp"
install -o root -g root -m 0440 "$tmp" /etc/sudoers.d/projekt-audit-export
