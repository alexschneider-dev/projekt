import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => yaml.load(fs.readFileSync(path.join(root, file), "utf8"));
const callers = {
  "build-deploy-nextjs-and-migration.yml": "nextjs",
  "build-deploy-nginx.yml": "nginx",
};

for (const [file, service] of Object.entries(callers)) {
  test(`${service}: Build und optionale Bereitstellung verwenden den gemeinsamen Workflow`, () => {
    const workflow = read(`.github/workflows/${file}`);
    assert.equal(workflow.on.workflow_dispatch.inputs.deploy.type, "boolean");
    assert.equal(workflow.on.workflow_dispatch.inputs.deploy.default, true);
    const build = workflow.jobs.build.steps;
    assert.equal(build.filter(step => step.uses === "actions/checkout@v4").length, 1);
    const buildStep = build.find(step => step.uses === "docker/build-push-action@v6");
    assert.ok(buildStep.with.push);
    assert.ok(fs.existsSync(path.join(root, buildStep.with.file)));
    const deploy = workflow.jobs.deploy;
    assert.equal(deploy.needs, "build");
    assert.equal(deploy.if, "${{ inputs.deploy }}");
    assert.equal(deploy.uses, "./.github/workflows/deploy-production-service.yml");
    assert.equal(deploy.with.service, service);
    assert.equal(deploy.with.version, "${{ inputs.version }}");
    assert.equal(deploy.secrets, "inherit");
  });
}

test("Gemeinsame Bereitstellung prüft Reihenfolge, verhindert parallele Deploys und begrenzt Migrationen auf Next.js", () => {
  const job = read(".github/workflows/deploy-production-service.yml").jobs.deploy;
  assert.equal(job.environment, "Production");
  const stackJob = read(".github/workflows/deploy-production-stack.yml").jobs.deploy;
  assert.equal(job.concurrency.group, stackJob.concurrency.group);
  assert.equal(job.concurrency["cancel-in-progress"], false);
  const checkout = job.steps.findIndex(step => step.uses === "actions/checkout@v4");
  const sync = job.steps.findIndex(step => step.uses === "./.github/actions/sync-production");
  assert.ok(checkout >= 0 && sync > checkout);
  for (const name of ["Datenbankmigration ausführen"]) {
    assert.equal(job.steps.find(step => step.name === name).if, "inputs.service == 'nextjs'");
  }
  const update = job.steps.find(step => step.name === "Auf Produktion deployen");
  assert.equal(update.env.SERVICE, "${{ inputs.service }}");
  assert.match(update.run, /deploy\.sh '\$\{SERVICE\}' '\$\{VERSION\}'/);
  const validation = job.steps.findIndex(step => step.name === "Eingaben prüfen");
  assert.ok(validation > checkout && validation < sync);
});
