import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readdirSync,
  rmSync,
  readFileSync
} from "node:fs";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";


const installer = new URL("../production/install-release.sh", import.meta.url);

for (const probe of [true, false]) {
  test(`Installer prüft ein leeres Übergabeverzeichnis ohne Installation; Abfrage=${probe}`, t => {
    const directory = mkdtempSync("/tmp/projekt-deploy.");

    t.after(() => rmSync(directory, {
      recursive: true,
      force: true
    }));

    if (probe) writeFileSync(`${directory}/.check-compatibility`, "");

    const before = readdirSync(directory);
    const result = spawnSync("bash", [
      installer.pathname,
      directory
    ], { encoding: "utf8" });

    assert.equal(result.status, probe ? 0 : 1, result.stderr);
    assert.equal(result.stdout, probe ? "projekt-runtime-v1\n" : "");
    assert.deepEqual(readdirSync(directory), before);
  });
}

test("Synchronisierung prüft den Installer per sudo und entfernt den Prüfmodus vor dem Upload", () => {
  const action = yaml.load(readFileSync(
    new URL("../.github/actions/sync-production/action.yml", import.meta.url),
    "utf8"
  ));
  const script = action.runs.steps[0].run;
  const probe = script.indexOf("if ! compatibility=");
  const cleanup = script.indexOf("rm -- '$remote_dir/.check-compatibility'");
  const upload = script.indexOf('scp "${ssh_opts[@]}"');

  assert.ok(probe >= 0 && cleanup > probe && upload > cleanup);
  assert.match(script.slice(probe, cleanup), /sudo -n \/usr\/local\/lib\/projekt-deploy\/install-release\.sh/);
  assert.match(script.slice(probe, cleanup), /projekt-runtime-v1/);
  assert.ok(!script.includes("grep -Fq"));

  const syntax = spawnSync("bash", ["-n"], {
    input: script,
    encoding: "utf8"
  });

  assert.equal(syntax.status, 0, syntax.stderr);
});
