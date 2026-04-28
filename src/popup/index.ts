import browser from 'webextension-polyfill';
import './popup.css';
import {
  getAppConfig,
  getConnectionStatuses,
  getRecentAlerts,
  clearRecentAlerts,
} from '../utils/storage';
import type { StoredAlert } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

function levelClass(level: number) {
  if (level >= 12) return 'level-critical';
  if (level >= 7) return 'level-high';
  return 'level-medium';
}

function el<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

// ── Export ────────────────────────────────────────────────────────────────────

function downloadJSON(alerts: StoredAlert[]) {
  const blob = new Blob([JSON.stringify(alerts, null, 2)], { type: 'application/json' });
  trigger(URL.createObjectURL(blob), `wazuh-alerts-${Date.now()}.json`);
}

function downloadCSV(alerts: StoredAlert[]) {
  const header = 'timestamp,cluster,agent,level,rule_id,description';
  const rows = alerts.map((a) => {
    const s = a._source;
    return [
      s['@timestamp'],
      a.clusterName,
      s.agent.name,
      s.rule.level,
      s.rule.id,
      `"${s.rule.description.replace(/"/g, '""')}"`,
    ].join(',');
  });
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  trigger(URL.createObjectURL(blob), `wazuh-alerts-${Date.now()}.csv`);
}

function trigger(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderAlert(alert: StoredAlert): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'alert-item';
  const { rule, agent } = alert._source;
  li.innerHTML = `
    <div class="alert-header">
      <span class="level-badge ${levelClass(rule.level)}">L${rule.level}</span>
      <span class="cluster-tag">${alert.clusterName}</span>
      <span class="alert-time">${timeAgo(alert.notifiedAt)}</span>
    </div>
    <p class="alert-desc">${rule.description}</p>
    <p class="alert-agent">Agent: <strong>${agent.name}</strong></p>
  `;
  return li;
}

async function render(selectedCluster = '', agentQuery = '') {
  const [appConfig, statuses, allAlerts] = await Promise.all([
    getAppConfig(),
    getConnectionStatuses(),
    getRecentAlerts(),
  ]);

  const { clusters } = appConfig;
  const enabledClusters = clusters.filter((c) => c.enabled);

  // Status dot — pick worst status among enabled clusters
  const dot = el('status-dot');
  dot.className = 'status-dot';
  if (clusters.length === 0) {
    dot.classList.add('status-unknown');
    dot.title = 'No clusters';
  } else if (enabledClusters.length === 0) {
    dot.classList.add('status-disabled');
    dot.title = 'All disabled';
  } else {
    const anyError = enabledClusters.some((c) => statuses[c.id] && !statuses[c.id].connected);
    const allConnected = enabledClusters.every((c) => statuses[c.id]?.connected);
    dot.classList.add(allConnected ? 'status-ok' : anyError ? 'status-error' : 'status-unknown');
    dot.title = allConnected ? 'All connected' : anyError ? 'Connection error on one or more clusters' : 'Pending';
  }

  // Panels
  if (clusters.length === 0) {
    el('state-empty').classList.remove('hidden');
    return;
  }
  if (enabledClusters.length === 0) {
    el('state-disabled').classList.remove('hidden');
    return;
  }
  el('main-panel').classList.remove('hidden');

  // Populate cluster dropdown
  const select = el<HTMLSelectElement>('cluster-select');
  const currentVal = select.value || selectedCluster;
  select.innerHTML = '<option value="">All clusters</option>';
  clusters.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
  select.value = currentVal;

  // Last poll
  const lastChecks = enabledClusters
    .map((c) => statuses[c.id]?.lastCheck ?? 0)
    .filter(Boolean);
  const latest = lastChecks.length ? Math.max(...lastChecks) : 0;
  el('last-poll').textContent = latest ? `Last poll: ${timeAgo(latest)}` : 'Last poll: never';

  // Filter alerts
  let filtered = allAlerts;
  if (currentVal) filtered = filtered.filter((a) => a.clusterId === currentVal);
  if (agentQuery.trim())
    filtered = filtered.filter((a) =>
      a._source.agent.name.toLowerCase().includes(agentQuery.toLowerCase())
    );

  el('alert-count').textContent = filtered.length ? `${filtered.length} alert${filtered.length > 1 ? 's' : ''}` : '';

  const list = el('alerts-list');
  const empty = el('alerts-empty');
  list.innerHTML = '';

  if (filtered.length === 0) {
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    filtered.slice(0, 15).forEach((a) => list.appendChild(renderAlert(a)));
  }

  await browser.runtime.sendMessage({ type: 'CLEAR_BADGE' });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await render();

  const openOptions = () => browser.runtime.openOptionsPage();
  el('btn-options').addEventListener('click', openOptions);
  el('btn-open-options').addEventListener('click', openOptions);
  el('btn-open-options-2').addEventListener('click', openOptions);

  el('btn-poll').addEventListener('click', async () => {
    const btn = el<HTMLButtonElement>('btn-poll');
    btn.disabled = true;
    btn.textContent = '…';
    await browser.runtime.sendMessage({ type: 'POLL_NOW' });
    await new Promise((r) => setTimeout(r, 1500));
    await render(el<HTMLSelectElement>('cluster-select').value, el<HTMLInputElement>('agent-filter').value);
    btn.disabled = false;
    btn.textContent = '↻';
  });

  el('btn-clear').addEventListener('click', async () => {
    await clearRecentAlerts();
    await render();
  });

  el<HTMLSelectElement>('cluster-select').addEventListener('change', (e) =>
    render((e.target as HTMLSelectElement).value, el<HTMLInputElement>('agent-filter').value)
  );

  let agentTimer: ReturnType<typeof setTimeout>;
  el<HTMLInputElement>('agent-filter').addEventListener('input', (e) => {
    clearTimeout(agentTimer);
    agentTimer = setTimeout(
      () => render(el<HTMLSelectElement>('cluster-select').value, (e.target as HTMLInputElement).value),
      250
    );
  });

  el('btn-export-json').addEventListener('click', async () => {
    const alerts = await getRecentAlerts();
    downloadJSON(alerts);
  });

  el('btn-export-csv').addEventListener('click', async () => {
    const alerts = await getRecentAlerts();
    downloadCSV(alerts);
  });
});
