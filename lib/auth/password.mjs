import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    throw new Error("Das Passwort muss 12 bis 128 Zeichen enthalten.");
  }
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64, options);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export const dummyHash = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;
export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || password.length > 128) return false;
  const valid = /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded);
  const [, salt, key] = (valid ? encoded : dummyHash).split("$");
  const actual = await derive(password, salt, 64, options);
  return timingSafeEqual(actual, Buffer.from(key, "hex")) && valid;
}
