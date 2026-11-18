import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  dirname,
  join
} from 'node:path';
import {
  configFiles,
  configRevisions
} from './config-revisions.mjs';


test('Eine Dashboard-Änderung versioniert nur ihre eigene Swarm Config', () => {
  const root = mkdtempSync(join(tmpdir(), 'obs-revisions-'));

  try {
    for (const path of Object.values(configFiles)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), `original ${path}`);
    }

    const before = configRevisions(root);

    assert.deepEqual(configRevisions(root), before);

    writeFileSync(join(root, configFiles.grafana_overview_json), 'changed dashboard');

    const after = configRevisions(root);

    assert.deepEqual(
      Object.keys(before).filter(key => before[key] !== after[key]),
      ['OBS_CONFIG_GRAFANA_OVERVIEW_JSON']
    );

    writeFileSync(join(root, configFiles.grafana_overview_json), `original ${configFiles.grafana_overview_json}`);

    assert.deepEqual(configRevisions(root), before);
  } finally {
    rmSync(root, {
      recursive: true,
      force: true
    });
  }
});

test('Das Installationspaket enthält alle versionierten Swarm-Konfigurationen', () => {
  const source = fileURLToPath(new URL('.', import.meta.url));
  const installer = readFileSync(join(source, 'install-release.sh'), 'utf8');
  const manifest = installer.match(/^files=\(\n([\s\S]*?)\n\)/m);
  assert.ok(manifest);
  const files = manifest[1].trim().split(/\s+/);
  const release = mkdtempSync(join(tmpdir(), 'obs-release-'));

  try {
    for (const path of files) {
      mkdirSync(dirname(join(release, path)), { recursive: true });
      copyFileSync(join(source, path), join(release, path));
    }

    assert.deepEqual(configRevisions(release), configRevisions(source));
  } finally {
    rmSync(release, {
      recursive: true,
      force: true
    });
  }
});
