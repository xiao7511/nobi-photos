\set ON_ERROR_STOP on
SELECT json_build_object(
  'verified_at', now(),
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'migration_version', (SELECT max(version) FROM nobi_photos_ops.schema_migrations),
  'business_table_count', (SELECT count(*) FROM information_schema.tables WHERE table_schema='nobi_photos_business'),
  'runtime_superuser', (SELECT rolsuper FROM pg_roles WHERE rolname='nobi_photos_app'),
  'runtime_bypass_rls', (SELECT rolbypassrls FROM pg_roles WHERE rolname='nobi_photos_app'),
  'anonymous_business_usage', has_schema_privilege('anon','nobi_photos_business','USAGE'),
  'runtime_ops_usage', has_schema_privilege('nobi_photos_app','nobi_photos_ops','USAGE')
);
