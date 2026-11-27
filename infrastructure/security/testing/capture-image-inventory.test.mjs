import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import yaml from "../../../apps/stellensuche/node_modules/js-yaml/index.js";


const action = yaml.load(readFileSync(new URL("../../../.github/actions/capture-image-inventory/action.yml", import.meta.url), "utf8"));
const script = action.runs.steps[0].run;

// Shell-Funktionen ersetzen SSH, Wartezeit und Import vollständig; keine Serververbindung.
const stubs = `
ssh() {
  attempt_count=$((attempt_count + 1))
  echo "$attempt_count" > "$RUNNER_TEMP/attempts"
  if (( attempt_count <= FAILURES )); then
    echo 'unvollständiger Export'
    echo "$FAILURE_MESSAGE" >&2
    return 1
  fi
  echo 'vollständiger Export'
}
sleep() { echo "$1" >> "$RUNNER_TEMP/waits"; }
python3() {
  test "$(cat "$RUNNER_TEMP/deployed-images.txt")" = 'vollständiger Export'
  echo 'importiert' > "$RUNNER_TEMP/imported"
}
attempt_count=0
`;

function capture(failures, message) {
  const directory = mkdtempSync(path.join(tmpdir(), "projekt-inventory-test-"));

  try {
    const result = spawnSync("bash", [
      "-c",
      stubs + script,
    ], {
      encoding: "utf8",
      env: {
        ...process.env,
        RUNNER_TEMP: directory,
        PROD_HOST: "test.invalid",
        PROD_USER: "test",
        FAILURES: String(failures),
        FAILURE_MESSAGE: message,
      },
    });

    return {
      status: result.status,
      attempts: Number(readFileSync(path.join(directory, "attempts"), "utf8")),
      stderr: result.stderr,
    };
  } finally {
    rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
}

test("Inventarerfassung wartet nur bei vorübergehenden Rollout-Zuständen", () => {
  for (const message of [
    "dienst: Tasks starten noch oder werden beendet.",
    "dienst: Bereitstellung ist noch nicht abgeschlossen.",
    "dienst: Dienst hat sich während des Exports geändert.",
  ]) {
    const result = capture(2, message);

    assert.equal(result.status, 0);
    assert.equal(result.attempts, 3);
  }
});

test("Inventarerfassung bricht nach 13 Versuchen ab", () => {
  const result = capture(99, "dienst: Bereitstellung ist noch nicht abgeschlossen.");

  assert.equal(result.status, 1);
  assert.equal(result.attempts, 13);
});

test("Inventarerfassung wiederholt keine Zugriffs- oder Integritätsfehler", () => {
  for (const message of [
    "Permission denied",
    "dienst: Laufende Tasks verwenden verschiedene Images.",
  ]) {
    const result = capture(99, message);

    assert.equal(result.status, 1);
    assert.equal(result.attempts, 1);
  }
});
