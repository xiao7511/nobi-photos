#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "$0")"
[[ $(pwd -P) == /opt/nobi-photos-cloud && $(id -u) == 0 ]] || exit 1
mkdir -p backups
destination="backups/nobi-photos-$(date -u +%Y%m%dT%H%M%SZ).dump"
temporary=$(mktemp backups/.nobi-backup.XXXXXX)
trap 'rm -f -- "$temporary"' EXIT
docker exec nobi-photos-cloud-db pg_dump --no-password --username supabase_admin --dbname nobi_photos_cloud --format custom > "$temporary"
test -s "$temporary"
docker exec -i nobi-photos-cloud-db pg_restore --list < "$temporary" >/dev/null
mv -- "$temporary" "$destination"
printf 'Backup created: %s\n' "$destination"
