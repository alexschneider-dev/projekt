import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { z } from "zod";
import { ACCOUNT_ERRORS } from "./errors/account.mjs";


export function parseAccountArguments(args, roles, defaultRole) {
  if (args.length < 1 || args.length > 3) throw new Error(ACCOUNT_ERRORS.USAGE);

  const [
    emailArg,
    role = defaultRole,
    name
  ] = args;
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(emailArg);
  if (!email.success) throw new Error(ACCOUNT_ERRORS.EMAIL);
  if (!roles.includes(role)) throw new Error(ACCOUNT_ERRORS.ROLE);

  return {
    email: email.data,
    role,
    name: name ?? null
  };
}

export async function readAccountPassword() {
  if (!process.stdin.isTTY) throw new Error(ACCOUNT_ERRORS.TERMINAL);

  const output = new Writable({
    write(_chunk, _encoding, done) { done(); }
  });
  const prompt = createInterface({
    input: process.stdin,
    output,
    terminal: true
  });

  try {
    process.stdout.write("Passwort (12–128 Zeichen, verdeckte Eingabe): ");
    const password = await prompt.question("");
    if (password.length < 12 || password.length > 128) throw new Error(ACCOUNT_ERRORS.PASSWORD_LENGTH);

    process.stdout.write("\nPasswort wiederholen: ");
    const confirmation = await prompt.question("");
    if (password !== confirmation) throw new Error(ACCOUNT_ERRORS.PASSWORD_MISMATCH);

    return password;
  } finally {
    prompt.close();
    process.stdout.write("\n");
  }
}

export function reportAccountFailure(error) {
  const message = error?.code === "P2002"
    ? ACCOUNT_ERRORS.EXISTS
    : Object.values(ACCOUNT_ERRORS).includes(error?.message)
      ? error.message
      : ACCOUNT_ERRORS.FAILED;
  console.error(message);
  process.exitCode = 1;
}
