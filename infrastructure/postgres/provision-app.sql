-- Als Administrator mit psql -X -v app_schema=stellensuche ausführen.
-- DATABASE_APP_PASSWORD wird aus der Prozessumgebung gelesen, nicht als Argument.
\set ON_ERROR_STOP on
\set ECHO none
\ir errors/messages.sql
\getenv app_password DATABASE_APP_PASSWORD
\if :{?app_schema}
\else
  \set error_message :error_arguments
  \ir errors/abort.sql
\endif
\if :{?app_password}
\else
  \set error_message :error_arguments
  \ir errors/abort.sql
\endif

SELECT :'app_schema' ~ '^[a-z][a-z0-9_]{2,39}$'
  AND :'app_schema' NOT IN ('public', 'information_schema')
  AND :'app_schema' NOT LIKE 'pg\_%'
  AS valid_arguments,
  :'app_schema' || '_app' AS app_role,
  current_database() AS database_name,
  (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_admin
\gset
\if :valid_arguments
\else
  \set error_message :error_arguments
  \ir errors/abort.sql
\endif
\if :is_admin
\else
  \set error_message :error_admin
  \ir errors/abort.sql
\endif

BEGIN;
-- Passwörter auch bei sonst aktiviertem SQL-Logging nicht protokollieren.
SET LOCAL log_statement = 'none';
SET LOCAL log_min_duration_statement = -1;
SET LOCAL log_min_duration_sample = -1;
SELECT length(:'app_password') >= 24 AS valid_password
\gset
\if :valid_password
\else
  \set error_message :error_arguments
  \ir errors/abort.sql
\endif
-- Serialisiert die Einrichtung verschiedener Anwendungen in derselben Datenbank.
SELECT pg_advisory_xact_lock(752390184);
SELECT NOT EXISTS (
  SELECT 1 FROM pg_roles r
  WHERE r.rolname = :'app_role' AND (
    r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls
    OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = :'app_schema' AND nspowner = r.oid)
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid OR roleid = r.oid)
    OR EXISTS (SELECT 1 FROM pg_database WHERE datdba = r.oid)
    OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner = r.oid AND nspname <> :'app_schema')
  )
) AS safe_role,
NOT EXISTS (
  SELECT 1 FROM pg_namespace n JOIN pg_roles r ON r.oid = n.nspowner
  WHERE n.nspname = :'app_schema' AND r.rolname <> :'app_role'
) AS safe_schema
\gset
\if :safe_role
\else
  \set error_message :error_role
  \ir errors/abort.sql
\endif
\if :safe_schema
\else
  \set error_message :error_schema
  \ir errors/abort.sql
\endif

SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT', :'app_role')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'app_role', :'app_password')
\gexec
SELECT format('CREATE SCHEMA %I AUTHORIZATION %I', :'app_schema', :'app_role')
WHERE NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = :'app_schema')
\gexec

-- Ein neuer Anwendungsbenutzer darf weder fremde Schemas anlegen noch public nutzen.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SELECT format('REVOKE CREATE ON DATABASE %I FROM PUBLIC', :'database_name')
\gexec
SELECT format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I', :'database_name', :'app_role')
\gexec
SELECT format('REVOKE ALL ON SCHEMA %I FROM PUBLIC', :'app_schema')
\gexec
SELECT format('ALTER ROLE %I IN DATABASE %I SET search_path = %I', :'app_role', :'database_name', :'app_schema')
\gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', :'app_role')
\gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE USAGE ON TYPES FROM PUBLIC', :'app_role')
\gexec
COMMIT;
