#!/bin/sh
set -eu

# Nur ausdrücklich mit diesem Präfix eingebundene Dateien werden Prozessvariablen.
# Kein source/eval: Shell-Syntax in Zugangsdaten bleibt unveränderter Text.
for secret_file in /run/secrets/runtime_*; do
  [ -f "$secret_file" ] || continue
  key="${secret_file##*/runtime_}"
  case "$key" in
    ''|[0-9]*|*[!A-Za-z0-9_]*) echo "Ungültiger Variablenname für ein Secret" >&2; exit 1 ;;
  esac
  # Das abschließende Zeichen erhält auch Zeilenumbrüche am Ende des Wertes.
  value="$(cat "$secret_file"; printf '.')"
  export "$key=${value%.}"
done
exec "$@"
