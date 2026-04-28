import browser from 'webextension-polyfill';
import './options.css';
import {
  getAppConfig,
  saveAppConfig,
  makeCluster,
  clearRecentAlerts,
  getRecentAlerts,
} from '../utils/storage';
import { testConnection } from '../utils/api';
import type { AppConfig, ClusterConfig, ConnectionMode } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function el<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function showSaveStatus(msg: string, ok: boolean) {
  const s = el('save-status');
  s.textContent = msg;
  s.className = `save-status ${ok ? 'result-ok' : 'result-error'}`;
  setTimeout(() => (s.textContent = ''), 3000);
}

// ── Export ────────────────────────────────────────────────────────────────────

function triggerDownload(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportJSON() {
  const alerts = await getRecentAlerts();
  const blob = new Blob([JSON.stringify(alerts, null, 2)], { type: 'application/json' });
  triggerDownload(URL.createObjectURL(blob), `wazuh-alerts-${Date.now()}.json`);
}

async function exportCSV() {
  const alerts = await getRecentAlerts();
  const header = 'timestamp,cluster,agent,level,rule_id,description';
  const rows = alerts.map((a) => {
    const s = a._source;
    return [s['@timestamp'], a.clusterName, s.agent.name, s.rule.level, s.rule.id,
      `"${s.rule.description.replace(/"/g, '""')}"`].join(',');
  });
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  triggerDownload(URL.createObjectURL(blob), `wazuh-alerts-${Date.now()}.csv`);
}

// ── Cluster list ──────────────────────────────────────────────────────────────

let appConfig: AppConfig = { clusters: [], soundEnabled: true };

function renderClusterList() {
  const list = el('cluster-list');
  list.innerHTML = '';

  if (appConfig.clusters.length === 0) {
    list.innerHTML = '<p class="empty-hint">No clusters yet. Add one to get started.</p>';
    return;
  }

  appConfig.clusters.forEach((cluster, idx) => {
    const card = document.createElement('div');
    card.className = 'cluster-card';
    card.innerHTML = `
      <div class="cluster-info">
        <span class="cluster-mode-icon">${cluster.mode === 'cloud' ? '☁' : '🖥'}</span>
        <div class="cluster-meta">
          <span class="cluster-name">${cluster.name}</span>
          <span class="cluster-url">${cluster.mode === 'cloud' ? cluster.dashboardUrl : cluster.opensearchUrl}</span>
        </div>
      </div>
      <div class="cluster-actions">
        <label class="switch switch-sm">
          <input type="checkbox" class="cluster-toggle" data-idx="${idx}" ${cluster.enabled ? 'checked' : ''} />
          <span class="slider"></span>
        </label>
        <button class="btn-icon-sm edit-btn" data-idx="${idx}" title="Edit">✎</button>
        <button class="btn-icon-sm delete-btn" data-idx="${idx}" title="Delete">🗑</button>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll<HTMLInputElement>('.cluster-toggle').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).dataset['idx']!);
      appConfig.clusters[idx].enabled = (e.target as HTMLInputElement).checked;
    });
  });

  list.querySelectorAll<HTMLButtonElement>('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openModal(parseInt(btn.dataset['idx']!)));
  });

  list.querySelectorAll<HTMLButtonElement>('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset['idx']!);
      appConfig.clusters.splice(idx, 1);
      renderClusterList();
    });
  });
}

// ── Modal ─────────────────────────────────────────────────────────────────────

let editingIdx = -1;

function setModalMode(mode: ConnectionMode) {
  document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((b) =>
    b.classList.toggle('active', b.dataset['mode'] === mode)
  );
  el('m-selfhosted').classList.toggle('hidden', mode !== 'selfhosted');
  el('m-cloud').classList.toggle('hidden', mode !== 'cloud');
}

function getModalMode(): ConnectionMode {
  return (document.querySelector<HTMLButtonElement>('.mode-tab.active')?.dataset['mode'] ??
    'selfhosted') as ConnectionMode;
}

function readModal(): ClusterConfig {
  const base = editingIdx >= 0 ? appConfig.clusters[editingIdx] : makeCluster();
  return {
    ...base,
    name: el<HTMLInputElement>('c-name').value.trim() || 'My Cluster',
    mode: getModalMode(),
    opensearchUrl: el<HTMLInputElement>('c-opensearch-url').value.trim(),
    username: el<HTMLInputElement>('c-username').value.trim(),
    password: el<HTMLInputElement>('c-password').value,
    dashboardUrl: el<HTMLInputElement>('c-dashboard-url').value.trim(),
    pollIntervalMinutes: Math.max(1, parseInt(el<HTMLInputElement>('c-poll-interval').value) || 2),
    minAlertLevel: parseInt(el<HTMLInputElement>('c-min-level').value),
    agentFilter: el<HTMLInputElement>('c-agent-filter').value.trim(),
  };
}

function populateModal(cluster: ClusterConfig) {
  el<HTMLInputElement>('c-name').value = cluster.name;
  setModalMode(cluster.mode);
  el<HTMLInputElement>('c-opensearch-url').value = cluster.opensearchUrl;
  el<HTMLInputElement>('c-username').value = cluster.username;
  el<HTMLInputElement>('c-password').value = cluster.password;
  el<HTMLInputElement>('c-dashboard-url').value = cluster.dashboardUrl;
  el<HTMLInputElement>('c-poll-interval').value = String(cluster.pollIntervalMinutes);
  el<HTMLInputElement>('c-min-level').value = String(cluster.minAlertLevel);
  el('c-level-value').textContent = String(cluster.minAlertLevel);
  el<HTMLInputElement>('c-agent-filter').value = cluster.agentFilter;
  el('c-test-result').textContent = '';
}

function openModal(idx = -1) {
  editingIdx = idx;
  el('modal-title').textContent = idx >= 0 ? 'Edit Cluster' : 'Add Cluster';
  populateModal(idx >= 0 ? appConfig.clusters[idx] : makeCluster());
  el('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  el('modal-overlay').classList.add('hidden');
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  appConfig = await getAppConfig();
  renderClusterList();
  el<HTMLInputElement>('sound-enabled').checked = appConfig.soundEnabled;

  // Global save
  el('btn-save').addEventListener('click', async () => {
    appConfig.soundEnabled = el<HTMLInputElement>('sound-enabled').checked;
    await saveAppConfig(appConfig);
    await browser.runtime.sendMessage({ type: 'CONFIG_UPDATED' });
    showSaveStatus('✓ Saved', true);
  });

  el('btn-add-cluster').addEventListener('click', () => openModal());
  el('modal-close').addEventListener('click', closeModal);
  el('modal-cancel').addEventListener('click', closeModal);
  el('modal-overlay').addEventListener('click', (e) => {
    if (e.target === el('modal-overlay')) closeModal();
  });

  // Mode tabs inside modal
  document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((btn) =>
    btn.addEventListener('click', () => setModalMode(btn.dataset['mode'] as ConnectionMode))
  );

  // Level slider
  el<HTMLInputElement>('c-min-level').addEventListener('input', (e) => {
    el('c-level-value').textContent = (e.target as HTMLInputElement).value;
  });

  // Show/hide password
  el('c-toggle-password').addEventListener('click', () => {
    const input = el<HTMLInputElement>('c-password');
    const btn = el<HTMLButtonElement>('c-toggle-password');
    const hide = input.type === 'password';
    input.type = hide ? 'text' : 'password';
    btn.textContent = hide ? 'Hide' : 'Show';
  });

  // Test connection
  el('c-btn-test').addEventListener('click', async () => {
    const btn = el<HTMLButtonElement>('c-btn-test');
    btn.disabled = true; btn.textContent = 'Testing…';
    const result = await testConnection(readModal());
    const span = el('c-test-result');
    span.textContent = result.ok ? `✓ ${result.clusterName}` : `✗ ${result.error}`;
    span.className = `test-result ${result.ok ? 'result-ok' : 'result-error'}`;
    btn.disabled = false; btn.textContent = 'Test Connection';
  });

  // Save cluster from modal
  el('modal-save').addEventListener('click', () => {
    const cluster = readModal();
    if (editingIdx >= 0) {
      appConfig.clusters[editingIdx] = cluster;
    } else {
      appConfig.clusters.push(cluster);
    }
    renderClusterList();
    closeModal();
  });

  // Export / clear
  el('btn-export-json').addEventListener('click', exportJSON);
  el('btn-export-csv').addEventListener('click', exportCSV);
  el('btn-clear-history').addEventListener('click', async () => {
    await clearRecentAlerts();
    showSaveStatus('History cleared', true);
  });
});
