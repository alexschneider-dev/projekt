import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";


const root = path.resolve(import.meta.dirname, "../../..");
const read = (file) => yaml.load(fs.readFileSync(path.join(root, file), "utf8"));
const callers = {
  "stellensuche-deploy.yml": "nextjs",
  "infrastructure-nginx.yml": "nginx",
  "marketplace-deploy.yml": "marketplace",
  "marketplace-websocket-deploy.yml": "marketplace-websocket",
};

for (const [file, service] of Object.entries(callers)) {
  test(`${service}: Build und optionale Bereitstellung verwenden den gemeinsamen Workflow`, () => {
    const workflow = read(`.github/workflows/${file}`);

    assert.equal(workflow.on.workflow_dispatch.inputs.deploy.type, "boolean");
    assert.equal(workflow.on.workflow_dispatch.inputs.deploy.default, service !== "marketplace-websocket");

    const build = workflow.jobs.build.steps;

    assert.equal(build.filter(step => step.uses === "actions/checkout@v4").length, 1);

    const buildStep = build.find(step => step.uses === "docker/build-push-action@v6");

    if (service === "nginx") {
      assert.ok(buildStep.with.load);
      const verification = build.findIndex(step => step.name === "Proxy-Zugriff und Verbindungsabbrüche prüfen");
      const publication = build.findIndex(step => step.name === "Geprüftes Nginx-Image veröffentlichen");
      assert.ok(verification >= 0 && publication > verification);
    } else {
      assert.ok(buildStep.with.load);
    }
    assert.ok(fs.existsSync(path.join(root, buildStep.with.file)));

    const deploy = workflow.jobs.deploy;

    assert.equal(deploy.needs, "build");
    assert.equal(deploy.if, "${{ inputs.deploy }}");
    assert.equal(deploy.uses, "./.github/workflows/shared-deploy-service.yml");
    assert.equal(deploy.with.service, service);
    assert.equal(deploy.with.version, "${{ inputs.version }}");
    assert.equal(deploy.secrets, "inherit");
  });
}

test(
  "Gemeinsame Bereitstellung prüft Reihenfolge, verhindert parallele Deploys und begrenzt Migrationen auf Next.js",
  () => {
    const job = read(".github/workflows/shared-deploy-service.yml").jobs.deploy;

    assert.equal(job.environment, "Production");

    const stackJob = read(".github/workflows/infrastructure-stack.yml").jobs.deploy;

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
  }
);

test("Sicherheitsprüfung bleibt unabhängig von Testbuilds und blockiert Releases", () => {
  const tests = read(".github/workflows/stellensuche-tests.yml");
  const audit = tests.jobs.sicherheit;
  assert.equal(audit.uses, "./.github/workflows/shared-security-audit.yml");
  assert.equal(audit.if, undefined);
  assert.equal(audit["continue-on-error"], undefined);
  assert.equal(tests.jobs.pruefungen.needs, undefined);
  assert.equal(tests.jobs.visuell.needs, "pruefungen");

  const release = read(".github/workflows/stellensuche-deploy.yml");
  assert.ok(release.jobs.build.needs.includes("audit"));
  assert.ok(release.jobs.build.needs.includes("tests"));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "apps/stellensuche/package.json"), "utf8"));
  assert.equal(manifest.scripts.prebuild, "npm run audit:dependencies");
});

test("Nur der Sicherheits-Audit läuft täglich; Browserjobs verwenden eine feste Ubuntu-Version", () => {
  const directory = path.join(root, ".github/workflows");
  const scheduled = fs.readdirSync(directory).filter((file) => {
    return file.endsWith(".yml") && read(`.github/workflows/${file}`).on.schedule;
  });
  assert.deepEqual(scheduled, ["shared-security-audit.yml"]);
  const tests = read(".github/workflows/stellensuche-tests.yml");
  assert.ok(Object.hasOwn(tests.on, "push"));
  assert.ok(Object.hasOwn(tests.on, "pull_request"));
  assert.ok(Object.hasOwn(tests.on, "workflow_dispatch"));
  assert.ok(Object.hasOwn(tests.on, "workflow_call"));
  assert.equal(tests.jobs.browsermatrix.if, "inputs.browser_matrix == true");

  for (const name of [
    "integration",
    "browsermatrix",
  ]) {
    const job = tests.jobs[name];
    assert.equal(job["runs-on"], "ubuntu-24.04");
    const install = job.steps.find((step) => step.uses === "./.github/actions/install-playwright");
    assert.equal(install.with.browsers, name === "integration" ? "chromium" : "chromium firefox webkit");
  }
});

test("Pushes bleiben schnell und Anwendungsbuilds verlangen die umfangreichen Prüfungen", () => {
  const tests = read(".github/workflows/stellensuche-tests.yml");
  const release = read(".github/workflows/stellensuche-deploy.yml");
  const fast = tests.jobs.pruefungen.steps.map((step) => step.run ?? "").join("\n");
  assert.match(fast, /npm run check/);
  assert.match(fast, /npm run test:legacy/);
  assert.match(fast, /npm run test:unit/);
  assert.doesNotMatch(fast, /test:e2e|test:visual|test:db|test:coverage|playwright install/);

  for (const name of [
    "full",
    "browser_matrix",
  ]) {
    assert.equal(tests.on.workflow_call.inputs[name].type, "boolean");
    assert.equal(tests.on.workflow_call.inputs[name].default, false);
    assert.equal(tests.on.workflow_dispatch.inputs[name].default, true);
  }

  assert.equal(release.jobs.tests.with.full, true);
  assert.equal(release.jobs.tests.with.browser_matrix, false);
  assert.equal(tests.jobs.integration.if, "inputs.full == true");
  assert.equal(tests.jobs.integration.needs, "pruefungen");
  assert.equal(tests.jobs.visuell.if, "inputs.full == true");
  assert.equal(tests.jobs.browsermatrix.if, "inputs.browser_matrix == true");
});

test("Jedes Nginx-Release prüft das gebaute Image vor der Veröffentlichung", () => {
  for (const file of Object.keys(callers).filter(name => name !== "marketplace-websocket-deploy.yml")) {
    const steps = read(`.github/workflows/${file}`).jobs.build.steps;
    const auditIndex = steps.findIndex(step => step.uses === "./.github/actions/audit-image" && step.with.image.includes("nginx"));
    const publicationIndex = steps.findIndex(step => step.name === "Geprüftes Nginx-Image veröffentlichen");
    const image = steps[auditIndex]?.with.image;
    const buildIndex = steps.findIndex(step => step.with?.tags?.includes(image));
    assert.ok(buildIndex >= 0 && auditIndex > buildIndex && publicationIndex > auditIndex);
    assert.equal(steps[buildIndex].with.push, undefined);
    assert.equal(steps[buildIndex].with.load, true);
    assert.equal(steps[buildIndex].with.pull, true);
    assert.equal(steps[buildIndex].with["no-cache"], true);
    assert.equal(steps[auditIndex]["continue-on-error"], undefined);
    assert.equal(steps[publicationIndex].if, undefined);
  }

  const scan = read(".github/actions/audit-image/action.yml").runs.steps.find(step => step.uses?.startsWith("aquasecurity/trivy-action@"));
  assert.equal(scan.with["exit-code"], "${{ inputs.report-only == 'true' && '0' || '1' }}");
  assert.equal(scan.with["ignore-unfixed"], false);
  assert.equal(scan.with.severity, "UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL");
  const workflow = read(".github/workflows/shared-security-audit.yml");
  assert.equal(workflow.jobs.nginx.if, undefined);
  assert.deepEqual(workflow.jobs.nginx.strategy.matrix.context, [
    "infrastructure/nginx",
    "apps/stellensuche/services/nginx",
    "apps/marketplace/services/nginx",
  ]);
});

test("WebSocket-Release prüft Workspace-Laufzeit und Sicherheitsbefund vor der Veröffentlichung", () => {
  const steps = read(".github/workflows/marketplace-websocket-deploy.yml").jobs.build.steps;
  const runtime = steps.findIndex(step => step.name === "WebSocket-Laufzeit isoliert prüfen");
  const audit = steps.findIndex(step => step.uses === "./.github/actions/audit-image");
  const publish = steps.findIndex(step => step.name === "Geprüftes WebSocket-Image veröffentlichen");
  assert.ok(runtime >= 0 && audit > runtime && publish > audit);
  assert.equal(steps[audit]["continue-on-error"], undefined);
});
