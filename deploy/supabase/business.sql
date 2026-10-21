\set ON_ERROR_STOP on
\set app_password `cat /run/secrets/app_password`
CREATE ROLE nobi_photos_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE nobi_photos_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
\unset app_password
CREATE DATABASE nobi_photos_cloud OWNER nobi_photos_owner;
REVOKE ALL ON DATABASE nobi_photos_cloud FROM PUBLIC;
GRANT CONNECT ON DATABASE nobi_photos_cloud TO nobi_photos_app;
ALTER ROLE nobi_photos_app SET statement_timeout = '5s';
ALTER ROLE nobi_photos_app SET search_path = nobi_photos_business, pg_catalog;
\connect nobi_photos_cloud
BEGIN;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA nobi_photos_business AUTHORIZATION nobi_photos_owner;
CREATE SCHEMA nobi_photos_ops AUTHORIZATION nobi_photos_owner;
REVOKE ALL ON SCHEMA nobi_photos_business, nobi_photos_ops FROM PUBLIC;
GRANT USAGE ON SCHEMA nobi_photos_business TO nobi_photos_app;
COMMENT ON SCHEMA nobi_photos_business IS 'Reserved for explicitly defined cloud business data. Photo metadata, albums, tags, favorites and media are device-only.';
CREATE TABLE nobi_photos_ops.schema_migrations (
  version bigint PRIMARY KEY,
  description text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE nobi_photos_ops.schema_migrations OWNER TO nobi_photos_owner;
ALTER TABLE nobi_photos_ops.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nobi_photos_ops.schema_migrations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA nobi_photos_ops FROM PUBLIC, nobi_photos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nobi_photos_owner IN SCHEMA nobi_photos_business REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE nobi_photos_owner IN SCHEMA nobi_photos_business REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
INSERT INTO nobi_photos_ops.schema_migrations(version, description)
VALUES (202610210001, 'Isolated cloud database foundation; no photo or user data');
COMMIT;
