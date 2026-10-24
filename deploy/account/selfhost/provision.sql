\set ON_ERROR_STOP on
-- Dedicated existing NOBI Photos database/container ONLY; no photo tables are added.
CREATE ROLE nobi_photos_auth LOGIN PASSWORD :'auth_password' CONNECTION LIMIT 6
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE nobi_photos_cloud TO nobi_photos_auth;
CREATE SCHEMA auth AUTHORIZATION nobi_photos_auth;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
CREATE SCHEMA IF NOT EXISTS extensions AUTHORIZATION nobi_photos_owner;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA public, extensions TO nobi_photos_auth;
ALTER ROLE nobi_photos_auth SET search_path = auth, public, extensions;
ALTER ROLE nobi_photos_auth SET statement_timeout = '20s';
ALTER DEFAULT PRIVILEGES FOR ROLE nobi_photos_auth IN SCHEMA auth REVOKE ALL ON TABLES FROM PUBLIC;
