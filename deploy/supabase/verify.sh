#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "$0")"
[[ $(pwd -P) == /opt/nobi-photos-cloud && $(id -u) == 0 ]] || exit 1
container=nobi-photos-cloud-db
[[ $(docker inspect "$container" --format '{{index .Config.Labels "com.docker.compose.project"}}') == nobi-photos-cloud ]]
[[ $(docker inspect "$container" --format '{{.State.Health.Status}}') == healthy ]]
[[ $(docker port "$container" 5432/tcp) == 127.0.0.1:15432 ]]
[[ $(stat -c %a secrets/admin_password) == 400 && $(stat -c %a secrets/app_password) == 400 ]]
docker exec -i "$container" psql --no-psqlrc --set ON_ERROR_STOP=1 --username supabase_admin --dbname nobi_photos_cloud < verify.sql
role=$(docker exec "$container" sh -c 'export PGPASSWORD="$(cat /run/secrets/app_password)"; exec psql --no-psqlrc --host 127.0.0.1 --username nobi_photos_app --dbname nobi_photos_cloud -Atc "SELECT current_user"')
[[ $role == nobi_photos_app ]]
image_id=$(docker inspect "$container" --format '{{.Image}}')
host_database=$(docker run --rm --network host --memory 128m --entrypoint sh \
  --mount type=bind,src=/opt/nobi-photos-cloud/secrets/app_password,dst=/run/nobi_app_password,readonly \
  "$image_id" -c 'export PGPASSWORD="$(cat /run/nobi_app_password)"; exec psql --no-psqlrc --host 127.0.0.1 --port 15432 --username nobi_photos_app --dbname nobi_photos_cloud -Atc "SELECT current_database()"')
[[ $host_database == nobi_photos_cloud ]]
error_file=$(mktemp)
trap 'rm -f -- "$error_file"' EXIT
if docker exec -e PGPASSWORD=deliberately-invalid "$container" psql --no-psqlrc --host 127.0.0.1 --username nobi_photos_app --dbname nobi_photos_cloud -Atc 'SELECT 1' > /dev/null 2> "$error_file"; then
  echo 'Unexpected passwordless access' >&2
  exit 1
fi
grep -q 'password authentication failed' "$error_file"
if docker exec "$container" sh -c 'export PGPASSWORD="$(cat /run/secrets/app_password)"; exec psql --no-psqlrc --host 127.0.0.1 --username nobi_photos_app --dbname nobi_photos_cloud -Atc "SELECT * FROM nobi_photos_ops.schema_migrations"' >/dev/null 2> "$error_file"; then
  echo 'Unexpected runtime access to operations schema' >&2
  exit 1
fi
grep -q 'permission denied for schema nobi_photos_ops' "$error_file"
printf 'Verified: isolated database, loopback port, empty business schema, restricted runtime role, SCRAM authentication and denied operations access.\n'
