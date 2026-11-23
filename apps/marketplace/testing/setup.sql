\set ON_ERROR_STOP on
\getenv app_password DATABASE_APP_PASSWORD
SELECT format('CREATE ROLE marketplace_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'marketplace_app')
\gexec
CREATE SCHEMA IF NOT EXISTS marketplace AUTHORIZATION marketplace_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA IF NOT EXISTS stellensuche;
CREATE TABLE IF NOT EXISTS stellensuche.private_test (id integer);
