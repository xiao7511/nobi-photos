#!/bin/sh
set -eu
# Executed once, after the official image migrations, only in a new data volume.
export PGPASSWORD="${POSTGRES_PASSWORD:?Missing bootstrap password}"
psql --no-psqlrc --set ON_ERROR_STOP=1 --username supabase_admin --dbname postgres --file /nobi/business.sql
