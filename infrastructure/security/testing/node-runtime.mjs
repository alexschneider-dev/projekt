import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";


const require = createRequire("/app/package.json");
assert.notEqual(process.getuid(), 0);
for (const file of [
  "/usr/local/lib/node_modules/npm",
  "/usr/local/bin/npm",
  "/usr/local/bin/npx",
  "/usr/local/bin/yarn",
]) {
  assert.equal(fs.existsSync(file), false);
}

const sharp = require("sharp");
const image = await sharp({
  create: {
    width: 2,
    height: 2,
    channels: 3,
    background: "#ffffff",
  },
}).png().toBuffer();
assert.equal(image.subarray(1, 4).toString(), "PNG");

// Eine unerreichbare lokale Testdatenbank prüft den Start der nativen Prisma-Engine.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
try {
  await assert.rejects(prisma.$connect(), error => error.errorCode === "P1001");
} finally {
  await prisma.$disconnect();
}
console.log("Node-Laufzeit, Benutzerrechte, Sharp und Prisma erfolgreich geprüft.");
