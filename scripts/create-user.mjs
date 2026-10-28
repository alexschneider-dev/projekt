import { ERROR_ACCOUNT } from "../lib/http/errors/account.mjs";
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
if (![
  "user",
  "admin",
  "super_admin"
].includes(role)) {
  throw new Error(ERROR_ACCOUNT.INVALID_ROLE.message);
}
if (!process.stdin.isTTY) throw new Error(ERROR_ACCOUNT.INTERACTIVE_TERMINAL_REQUIRED.message);
const output = new Writable({
  write(
    _chunk,
    _encoding,
    done
  ) { done(); }
});
const prompt = createInterface({
  input: process.stdin,
  output,
  terminal: true
});
let password;
try {
  process.stdout.write("Passwort (12–128 Zeichen, verdeckte Eingabe): ");
  password = await prompt.question("");
  process.stdout.write("\nPasswort wiederholen: ");
  if (password !== await prompt.question("")) throw new Error(ERROR_ACCOUNT.PASSWORD_MISMATCH.message);
} finally {
  prompt.close();
  process.stdout.write("\n");
}
const prisma = new PrismaClient();
try {
  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      email,
      role,
      name: name ?? null,
      passwordHash
    }
  });
  console.log(`Konto angelegt: ${email} (${role})`);
} catch (error) {
  if (error.code === "P2002") console.error(ERROR_ACCOUNT.EMAIL_ALREADY_EXISTS.message);
  else console.error(ERROR_ACCOUNT.ACCOUNT_CREATION_FAILED.message);
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
