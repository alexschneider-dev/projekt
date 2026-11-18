import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { TEST_ENV } from "./support/environment.mjs";
import { TEST_ERRORS } from "./errors/index.mjs";


const [
  command,
  ...args
] = process.argv.slice(2);
const env = {
  ...process.env,
  ...TEST_ENV,
};

async function run(executable, parameters) {
  await new Promise((resolve, reject) => {
    const child = spawn(executable, parameters, {
      stdio: "inherit",
      env,
    });
    const stop = () => child.kill("SIGTERM");

    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    child.once("error", reject);
    child.once("exit", (code) => {
      process.removeListener("SIGTERM", stop);
      process.removeListener("SIGINT", stop);

      if (code === 0) resolve();
      else reject(new Error(TEST_ERRORS.COMMAND_FAILED, {
        cause: {
          executable,
          code,
        },
      }));
    });
  });
}

async function prepareDatabase() {
  await run("docker", [
    "compose",
    "-f",
    "testing/compose.yml",
    "up",
    "-d",
    "--wait",
  ]);
  await run("npx", [
    "prisma",
    "generate",
  ]);
  await run("npx", [
    "prisma",
    "migrate",
    "deploy",
  ]);
  await run(process.execPath, [
    "--experimental-strip-types",
    "testing/support/seed.mjs",
  ]);
}

try {
  if (command === "db") {
    await prepareDatabase();
  } else if (command === "down") {
    await run("docker", [
      "compose",
      "-f",
      "testing/compose.yml",
      "down",
      "--volumes",
    ]);
  } else if (command === "server") {
    await prepareDatabase();
    await run("npm", [
      "run",
      "build",
    ]);
    await run("npx", [
      "next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ]);
  } else if (command === "visual-build") {
    await run("npm", [
      "run",
      "build",
    ]);
  } else if (command === "visual-server") {
    await run("npx", [
      "next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ]);
  } else if (command === "visual" || command === "visual-update") {
    const directories = [
      "testing/visual/snapshots",
      "test-results",
      "playwright-report",
    ];

    for (const directory of directories) mkdirSync(directory, { recursive: true });

    await run("docker", [
      "build",
      "--platform=linux/arm64",
      "-f",
      "testing/Dockerfile.visual",
      "-t",
      "projekt-visual-tests",
      ".",
    ]);
    await run("docker", [
      "run",
      "--rm",
      "--init",
      "--platform=linux/arm64",
      "--ipc=host",
      "--env",
      `CI=${process.env.CI ?? ""}`,
      ...directories.flatMap(directory => [
        "--mount",
        `type=bind,source=${resolve(directory)},target=/app/${directory}`,
      ]),
      "projekt-visual-tests",
      "npx",
      "playwright",
      "test",
      "--config=playwright.visual.config.ts",
      ...(command === "visual-update" ? ["--update-snapshots"] : []),
    ]);
  } else if (command === "browser") {
    await run("npx", [
      "playwright",
      "test",
      ...args,
    ]);
  } else {
    throw new Error(TEST_ERRORS.UNKNOWN_COMMAND);
  }
} catch (error) {
  console.error(TEST_ERRORS.COMMAND_FAILED, error);
  process.exitCode = 1;
}
