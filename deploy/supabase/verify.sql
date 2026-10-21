\set ON_ERROR_STOP on
DO $$
BEGIN
  IF current_database() <> 'nobi_photos_cloud' THEN RAISE EXCEPTION 'Wrong database'; END IF;
  IF (SELECT count(*) FROM nobi_photos_ops.schema_migrations WHERE version=202610210001) <> 1 THEN
    RAISE EXCEPTION 'Missing bootstrap migration';
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema='nobi_photos_business') THEN
    RAISE EXCEPTION 'Business schema must remain empty until business scope is defined';
  END IF;
  IF has_schema_privilege('anon','nobi_photos_business','USAGE')
     OR has_schema_privilege('authenticated','nobi_photos_business','USAGE')
     OR has_schema_privilege('nobi_photos_app','nobi_photos_ops','USAGE') THEN
    RAISE EXCEPTION 'Unexpected schema access';
  END IF;
  IF NOT has_schema_privilege('nobi_photos_app','nobi_photos_business','USAGE')
     OR has_schema_privilege('nobi_photos_app','nobi_photos_business','CREATE') THEN
    RAISE EXCEPTION 'Incorrect runtime schema privileges';
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='nobi_photos_app' AND
    (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Runtime role is privileged';
  END IF;
END $$;
SELECT current_database() AS database, version, description FROM nobi_photos_ops.schema_migrations;
