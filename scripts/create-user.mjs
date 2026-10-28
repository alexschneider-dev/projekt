import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "../lib/auth/password.mjs";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const [emailArg, role = "user", name] = process.argv.slice(2);
const email = z.string().trim().toLowerCase().email().max(254).parse(emailArg);
if (!["user", "admin", "super_admin"].includes(role)) {
  throw new Error("Rolle muss user, admin oder super_admin sein.");
}
if (!process.stdin.isTTY) throw new Error("Bitte in einem interaktiven Terminal ausführen.");
const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
const prompt = createInterface({ input: process.stdin, output, terminal: true });
let password;
try {
  process.stdout.write("Passwort (12–128 Zeichen, verdeckte Eingabe): ");
  password = await prompt.question("");
  process.stdout.write("\nPasswort wiederholen: ");
  if (password !== await prompt.question("")) throw new Error("Passwörter stimmen nicht überein.");
} finally {
  prompt.close();
  process.stdout.write("\n");
}
const prisma = new PrismaClient();
try {
  const passwordHash = await hashPassword(password);
  // Create only: never overwrite an existing account or silently elevate its role.
  await prisma.user.create({ data: { email, role, name: name ?? null, passwordHash } });
  console.log(`Konto angelegt: ${email} (${role})`);
} catch (error) {
  if (error.code === "P2002") console.error("Für diese E-Mail existiert bereits ein Konto.");
  else console.error("Konto konnte nicht angelegt werden. Datenbank und Eingaben prüfen.");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
