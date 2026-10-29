import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';


export const configFiles = {
  grafana_datasources_yml: 'grafana/datasources.yml',
  grafana_dashboards_yml: 'grafana/dashboards.yml',
  grafana_alerting_yml: 'grafana/alerting.yml',
  grafana_error_html: 'grafana/error.html',
  grafana_overview_json: 'grafana/overview.json',
  prometheus_yml: 'prometheus.yml',
  loki_yml: 'loki.yml',
  tempo_yml: 'tempo.yml',
  alloy_alloy: 'alloy.alloy',
  exporters_errors_py: 'errors/messages.py',
  exporters_swarm_py: 'exporters/swarm.py',
};

export function configRevisions(directory) {
  return Object.fromEntries(Object.entries(configFiles).map(([
    name,
    path
  ]) => [
      `OBS_CONFIG_${name.toUpperCase()}`,
      createHash('sha256').update(readFileSync(resolve(directory, path))).digest('hex').slice(0, 16),
    ]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [
    key,
    value
  ] of Object.entries(configRevisions(fileURLToPath(new URL('.', import.meta.url))))) {
    console.log(`${key} ${value}`);
  }
}
