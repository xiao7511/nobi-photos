#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "$0")"
[[ $(pwd -P) == /opt/nobi-photos-cloud ]] || { echo 'Use only /opt/nobi-photos-cloud' >&2; exit 1; }
[[ $(id -u) == 0 ]] || { echo 'Run with sudo' >&2; exit 1; }
image='supabase/postgres:17.6.1.136@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00'
if docker container inspect nobi-photos-cloud-db >/dev/null 2>&1; then
  echo 'NOBI container already exists; refusing a fresh bootstrap.' >&2
  exit 1
fi
for volume in nobi_photos_cloud_data nobi_photos_cloud_config; do
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    echo 'A target data volume already exists; inspect it before proceeding.' >&2
    exit 1
  fi
done
if ss -H -lnt 'sport = :15432' | grep -q .; then
  echo 'Target port 15432 is occupied.' >&2
  exit 1
fi
mkdir -p secrets backups
chmod 700 secrets backups
db_uid=$(docker run --rm --network none --memory 128m --entrypoint id "$image" -u postgres)
db_gid=$(docker run --rm --network none --memory 128m --entrypoint id "$image" -g postgres)
[[ $db_uid =~ ^[0-9]+$ && $db_gid =~ ^[0-9]+$ ]]
for name in admin_password app_password; do
  if [[ ! -s secrets/$name ]]; then openssl rand -hex 32 > "secrets/$name"; fi
  chown "$db_uid:$db_gid" "secrets/$name"
  chmod 400 "secrets/$name"
done
# Config output never contains secret contents: Compose receives file paths only.
docker compose -f compose.yml config --quiet
docker compose -f compose.yml up -d --wait --wait-timeout 240
printf 'NOBI database started; passwords remain in root-protected local secret files.\n'
