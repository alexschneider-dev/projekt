#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")"
source errors/messages.sh
[[ ${1:-} =~ ^(prepare|backup|postgres-backup)$ ]] || { echo "$OBS_USAGE_ERROR" >&2; exit 1; }
settings="${2:-/etc/projekt/observability.env}"
[[ -r "$settings" ]] || { echo "$OBS_SETTINGS_ERROR" >&2; exit 1; }
set -a
source "$settings"
set +a
node --input-type=module -e 'import {validateSettings} from "./settings.mjs"; validateSettings(process.env);'
exec 9>/var/lock/projekt-deploy.lock
flock -w 900 9
python3 backup/storage.py "$1"
