import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  delimiter,
  join,
} from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { TEST_DATABASE_URL } from "./support/environment.mjs";


test("Testbuild läuft unabhängig vom Audit mit isolierter Umgebung", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "projekt-test-build-"));
  const log = join(directory, "commands.log");
  t.after(() => rmSync(directory, {
    recursive: true,
    force: true,
  }));

  for (const command of [
    "npm",
    "npx",
  ]) {
    writeFileSync(join(directory, command), `#!/bin/sh
printf '%s|%s|%s|%s\\n' '${command}' "$*" "$NEXT_TEST_BUILD" "$DATABASE_URL" >> "$TEST_COMMAND_LOG"
if [ '${command}' = npm ]; then exit 73; fi
`, { mode: 0o755 });
  }

  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("./run.mjs", import.meta.url)),
    "visual-build",
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${directory}${delimiter}${process.env.PATH}`,
      TEST_COMMAND_LOG: log,
      DATABASE_URL: "postgresql://unbenutzt.invalid/produktion",
      NEXT_TEST_BUILD: "false",
    },
    timeout: 10_000,
  });

  assert.equal(result.status, 0, result.stderr);
  const commands = readFileSync(log, "utf8").trim().split("\n").map((line) => line.split("|"));
  assert.ok(commands.some((entry) => entry[0] === "npx" && entry[1] === "prisma generate"));
  assert.ok(commands.some((entry) => entry[0] === "npx" && entry[1] === "next build"));
  assert.ok(commands.every((entry) => entry[2] === "true" && entry[3] === TEST_DATABASE_URL));
  assert.ok(commands.every((entry) => !entry[1].includes("audit")));
});
