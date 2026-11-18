import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import pg from "pg";
import { PrismaClient } from "@prisma/client";


const root = resolve(import.meta.dirname, "../../../..");
const application = resolve(import.meta.dirname, "../..");
const password = "Nur-fuer-Schema-Isolation-2026";

function docker(args) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    stdio: [
      "pipe",
      "pipe",
      "pipe",
    ],
  }).trim();
}

function migrate(url) {
  return execFileSync(resolve(application, "node_modules/.bin/prisma"), [
    "migrate",
    "deploy",
  ], {
    cwd: application,
    env: {
      ...process.env,
      DATABASE_URL: url,
    },
    encoding: "utf8",
    stdio: [
      "pipe",
      "pipe",
      "pipe",
    ],
  });
}

test("Eine Datenbank: Bestandsumzug und gegenseitige Schema-Isolation", { timeout: 120_000 }, async (t) => {
  const container = `projekt-schema-test-${randomUUID()}`;
  docker([
    "run",
    "--detach",
    "--name",
    container,
    "--env",
    `POSTGRES_PASSWORD=${password}`,
    "--publish",
    "127.0.0.1::5432",
    "--mount",
    `type=bind,source=${root}/infrastructure/postgres,target=/sql,readonly`,
    "--tmpfs",
    "/var/lib/postgresql/data",
    "postgres:17",
  ]);
  const cleanup = [];
  t.after(async () => {
    try {
      for (const close of cleanup.reverse()) await close();
    } finally {
      docker([
        "rm",
        "--force",
        container,
      ]);
    }
  });

  const port = docker([
    "port",
    container,
    "5432/tcp",
  ]).split(":").at(-1);
  const url = (role, schema) => `postgresql://${role}:${password}@127.0.0.1:${port}/postgres?schema=${schema}`;
  const admin = new pg.Client({ connectionString: url("postgres", "public") });
  cleanup.push(() => admin.end());
  let ready = false;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      docker([
        "exec",
        container,
        "pg_isready",
        "--host=127.0.0.1",
        "--username=postgres",
      ]);
      ready = true;
      break;
    } catch {
      await setTimeout(500);
    }
  }

  assert.ok(ready);
  await admin.connect();
  migrate(url("postgres", "public"));
  await admin.query(`INSERT INTO public."JobListing" ("userId", "url")
    SELECT "id", 'https://example.test/bestand' FROM public."User" LIMIT 1`);
  const before = await admin.query('SELECT * FROM public."JobListing" ORDER BY "id"');
  const history = await admin.query('SELECT id, checksum FROM public._prisma_migrations ORDER BY id');
  assert.equal(before.rows.length, 1);

  const sql = (file, schema = "stellensuche") => docker([
    "exec",
    "--env",
    `DATABASE_APP_PASSWORD=${password}`,
    container,
    "psql",
    "-X",
    "--username=postgres",
    "--dbname=postgres",
    "--set",
    `app_schema=${schema}`,
    "--file",
    `/sql/${file}`,
  ]);
  assert.throws(() => sql("provision-app.sql", "public"));
  sql("provision-app.sql");
  await admin.query("CREATE TABLE stellensuche.belegt (id integer)");
  assert.throws(() => sql("move-stellensuche.sql"));
  assert.deepEqual((await admin.query('SELECT * FROM public."JobListing" ORDER BY "id"')).rows, before.rows);
  await admin.query("DROP TABLE stellensuche.belegt");
  sql("move-stellensuche.sql");
  sql("move-stellensuche.sql");
  sql("provision-app.sql");
  assert.deepEqual((await admin.query('SELECT * FROM stellensuche."JobListing" ORDER BY "id"')).rows, before.rows);
  assert.deepEqual((await admin.query('SELECT id, checksum FROM stellensuche._prisma_migrations ORDER BY id')).rows, history.rows);
  assert.equal((await admin.query("SELECT to_regclass('public.\"User\"') AS table_name")).rows[0].table_name, null);
  assert.match(migrate(url("stellensuche_app", "stellensuche")), /No pending migrations/);

  const prisma = new PrismaClient({ datasourceUrl: url("stellensuche_app", "stellensuche") });
  cleanup.push(() => prisma.$disconnect());
  const user = await prisma.user.findFirstOrThrow();
  const inserted = await prisma.jobListing.create({
    data: {
      userId: user.id,
      url: "https://example.test/nach-umzug",
    },
  });
  assert.ok(inserted.id > before.rows[0].id);
  assert.equal(await prisma.jobListing.count(), 2);

  sql("provision-app.sql", "andere_anwendung");
  const first = new pg.Client({ connectionString: url("stellensuche_app", "stellensuche") });
  const second = new pg.Client({ connectionString: url("andere_anwendung_app", "andere_anwendung") });
  cleanup.push(() => first.end());
  cleanup.push(() => second.end());
  await first.connect();
  await second.connect();
  assert.equal((await first.query("SELECT current_schema() AS schema")).rows[0].schema, "stellensuche");
  assert.equal((await second.query("SELECT current_schema() AS schema")).rows[0].schema, "andere_anwendung");
  await second.query('CREATE TABLE "User" (id integer PRIMARY KEY)');
  await second.query('INSERT INTO "User" VALUES (42)');
  assert.equal((await second.query('SELECT id FROM "User"')).rows[0].id, 42);

  for (const query of [
    'SELECT * FROM stellensuche."User"',
    'INSERT INTO stellensuche."JobListing" (url) VALUES (\'fremd\')',
    'UPDATE stellensuche."User" SET active = false',
    'DELETE FROM stellensuche."JobListing"',
    'ALTER TABLE stellensuche."User" ADD COLUMN fremd text',
    'SELECT \'USER\'::stellensuche."InternalRole"',
    'CREATE TABLE public.fremd (id integer)',
    'CREATE SCHEMA fremd',
    'SET ROLE stellensuche_app',
  ]) {
    await assert.rejects(second.query(query), { code: "42501" });
  }

  await assert.rejects(first.query('SELECT * FROM andere_anwendung."User"'), { code: "42501" });
  await second.query("SET search_path = stellensuche");
  await assert.rejects(second.query('SELECT * FROM "User"'), { code: "42P01" });
  await assert.rejects(second.query('SELECT * FROM stellensuche."User"'), { code: "42501" });
  const roles = await admin.query(`SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
    FROM pg_roles WHERE rolname IN ('stellensuche_app', 'andere_anwendung_app')`);
  assert.equal(roles.rows.length, 2);
  assert.ok(roles.rows.every((role) => Object.values(role).every((value) => value === false)));
});
