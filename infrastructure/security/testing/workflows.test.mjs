import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import yaml from "../../../apps/stellensuche/node_modules/js-yaml/index.js";


const root = path.resolve(import.meta.dirname, "../../..");
const read = file => yaml.load(fs.readFileSync(path.join(root, file), "utf8"));

test("Alle Release-Images werden vor dem Push blockierend geprüft", () => {
  for (const file of [
    "stellensuche-deploy.yml",
    "marketplace-deploy.yml",
    "infrastructure-nginx.yml",
    "infrastructure-observability.yml",
  ]) {
    const workflow = read(`.github/workflows/${file}`);
    const steps = (workflow.jobs.build ?? workflow.jobs.validate).steps;
    for (const [index, step] of steps.entries()) {
      if (step.uses !== "docker/build-push-action@v6") continue;
      assert.equal(step.with.push, undefined);
      assert.equal(step.with.load, true);
      assert.equal(step.with.pull, true);
      assert.equal(step.with["no-cache"], true);
      const image = step.with.tags.trim().split("\n").at(-1);
      const scanIndex = steps.findIndex(candidate => {
        return candidate.uses === "./.github/actions/audit-image" && candidate.with.image === image;
      });
      assert.ok(scanIndex > index, `${file}: ${image}`);
      assert.equal(steps[scanIndex].with["report-only"], undefined);
      assert.equal(steps[scanIndex]["continue-on-error"], undefined);
      const repository = image.slice(0, image.lastIndexOf(":"));
      const publication = steps.findIndex(candidate => candidate.run?.includes(`docker push ${repository}:`)
        || candidate.run?.includes(`docker push "${repository}:`));
      assert.ok(publication > scanIndex, `${file}: ${repository}`);
    }
  }
});

test("Das Pflichtinventar enthält jeden Compose-Dienst einschließlich Edge", () => {
  const services = [];
  for (const [file, stack] of [
    [
      "production/compose.swarm.yml",
      "projekt",
    ],
    [
      "production/compose.edge.yml",
      "projekt-edge",
    ],
    [
      "infrastructure/observability/compose.swarm.yml",
      "observability",
    ],
  ]) {
    services.push(...Object.keys(read(file).services).map(name => `${stack}_${name}`));
  }
  const expected = JSON.parse(fs.readFileSync(path.join(root, "infrastructure/security/required-services.json")));
  assert.deepEqual(expected, services.sort());
});

test("Produktionsprüfungen benötigen frische Live-Daten; PRs erhalten keine Serverzugänge", () => {
  const workflow = read(".github/workflows/shared-security-audit.yml");
  assert.equal(workflow.on.workflow_call.inputs["skip-production-images"].default, true);
  assert.match(workflow.jobs["live-inventory"].if, /github.event_name == 'schedule'/);
  assert.match(workflow.jobs["live-inventory"].if, /default_branch/);
  assert.match(workflow.jobs.inventory.if, /needs.live-inventory.result == 'success'/);
  const scan = workflow.jobs.images.steps.find(step => step.uses === "./.github/actions/audit-image");
  assert.equal(scan.with.image, "${{ matrix.image }}");
  assert.equal(scan.with["report-only"], undefined);
});

test("Hersteller-Builds verwenden vorhandene Kontexte und veröffentlichen erst nach Prüfung", () => {
  const job = read(".github/workflows/build-security-images.yml").jobs.build;
  const exporters = JSON.parse(fs.readFileSync(path.join(root, "infrastructure/security/images/exporters/images.json")));
  for (const entry of job.strategy.matrix.include) {
    assert.ok(fs.existsSync(path.join(root, entry.context, "Dockerfile")));
    if (entry.exporter) assert.equal(exporters[entry.exporter].image, entry.image);
  }
  const audit = job.steps.findIndex(step => step.uses === "./.github/actions/audit-image");
  const push = job.steps.findIndex(step => step.run === 'docker push "$IMAGE"');
  assert.ok(push > audit);
  assert.match(job.steps[push].if, /workflow_dispatch/);
  assert.match(job.steps[push].if, /refs\/heads\/main/);
});

test("Observability-Deploys warten auf die Prüfung aller konfigurierten Images", () => {
  const workflow = read(".github/workflows/infrastructure-observability.yml");
  assert.equal(workflow.on.workflow_dispatch.inputs.deploy.type, "boolean");
  assert.deepEqual(workflow.jobs.deploy.needs, [
    "validate",
    "audit-images",
  ]);
  assert.equal(workflow.jobs["audit-images"].needs, "validate");
  assert.equal(workflow.jobs["audit-images"].strategy.matrix.image, "${{ fromJSON(needs.validate.outputs.images) }}");
});

test("Trivy-Berichte werden isoliert gespeichert und Fehler bleiben blockierend", () => {
  const action = read(".github/actions/audit-image/action.yml");
  const steps = action.runs.steps;
  assert.equal(action.inputs["report-only"].default, "false");
  assert.match(steps[0].run, /rm -f.*image-audit.txt/);
  const scan = steps.find(step => step.uses?.startsWith("aquasecurity/trivy-action@"));
  assert.equal(scan.with.version, "v0.76.2");
  assert.equal(scan.with["ignore-unfixed"], false);
  assert.equal(scan.with.severity, "UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL");
  assert.equal(scan["continue-on-error"], undefined);
  const summary = steps.find(step => step.id === "summary");
  assert.equal(summary.if, "${{ always() }}");
  assert.match(summary.run, /limit = 200_000/);
  assert.match(summary.run, /hashlib.sha256/);
  const artifact = steps.find(step => step.uses === "actions/upload-artifact@v4");
  assert.equal(artifact.if, "${{ always() }}");
  assert.match(artifact.with.name, /github.run_attempt/);
  assert.match(artifact.with.name, /report_key/);
  assert.equal(artifact.with["retention-days"], 30);
});
