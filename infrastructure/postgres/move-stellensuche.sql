-- Einmaliger Bestandsumzug nach provision-app.sql; Anwendung und Import vorher stoppen.
-- Tabellen, Sequenzen, Typen und Prisma-Historie bleiben erhalten.
\set ON_ERROR_STOP on
\ir errors/messages.sql
BEGIN;
SELECT pg_advisory_xact_lock(752390184);
SELECT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_admin
\gset
\if :is_admin
\else
  \set error_message :error_admin
  \ir errors/abort.sql
\endif

SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS has_legacy
\gset
\if :has_legacy
  SELECT to_regnamespace('stellensuche') IS NOT NULL
    AND (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
      'User', 'LoginAttempt', 'PendingRegistration', 'JobListing', 'JobSearch', 'JobImportState'
    )) = 6
    AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = to_regnamespace('stellensuche'))
    AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = to_regnamespace('stellensuche'))
    AND NOT EXISTS (SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL)
    AND EXISTS (SELECT 1 FROM public._prisma_migrations
      WHERE migration_name = '20261117110000_user_import_schedule' AND finished_at IS NOT NULL)
    AS safe_legacy
  \gset
  \if :safe_legacy
  \else
    \set error_message :error_legacy
    \ir errors/abort.sql
  \endif

  ALTER TYPE public."InternalRole" SET SCHEMA stellensuche;
  ALTER TYPE public."JobStatus" SET SCHEMA stellensuche;
  ALTER TYPE stellensuche."InternalRole" OWNER TO stellensuche_app;
  ALTER TYPE stellensuche."JobStatus" OWNER TO stellensuche_app;
  REVOKE ALL ON TYPE stellensuche."InternalRole", stellensuche."JobStatus" FROM PUBLIC;

  -- Zugehörige Indizes, Constraints und eigene Sequenzen ziehen mit den Tabellen um.
  SELECT format('ALTER TABLE public.%I SET SCHEMA stellensuche', name)
  FROM unnest(ARRAY[
    'User', 'LoginAttempt', 'PendingRegistration', 'JobListing', 'JobSearch', 'JobImportState', '_prisma_migrations'
  ]) AS names(name)
  \gexec
  SELECT format('ALTER TABLE stellensuche.%I OWNER TO stellensuche_app', name)
  FROM unnest(ARRAY[
    'User', 'LoginAttempt', 'PendingRegistration', 'JobListing', 'JobSearch', 'JobImportState', '_prisma_migrations'
  ]) AS names(name)
  \gexec
  REVOKE ALL ON ALL TABLES IN SCHEMA stellensuche FROM PUBLIC;
  REVOKE ALL ON ALL SEQUENCES IN SCHEMA stellensuche FROM PUBLIC;
\else
  -- Leere Neuinstallation oder bereits abgeschlossener Umzug; kein Kopieren von Daten.
  SELECT NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'User', 'LoginAttempt', 'PendingRegistration', 'JobListing', 'JobSearch', 'JobImportState'
  )) AS no_orphans
  \gset
  \if :no_orphans
  \else
    \set error_message :error_legacy
    \ir errors/abort.sql
  \endif
\endif
COMMIT;
