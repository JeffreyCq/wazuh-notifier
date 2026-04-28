import browser from 'webextension-polyfill';
import './popup.css';
import { getConfig, getConnectionStatus, getRecentAlerts, clearRecentAlerts } from '../utils/storage';
import type { StoredAlert } from '../types';

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function levelColor(level: number): string {
  if (level >= 12) return 'level-critical';
  if (level >= 7) return 'level-high';
  return 'level-medium';
}

function renderAlert(alert: StoredAlert): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'alert-item';

  const { rule, agent } = alert._source;

  li.innerHTML = `
    <div class="alert-header">
      <span class="level-badge ${levelColor(rule.level)}">L${rule.level}</span>
      <span class="alert-time">${timeAgo(alert.notifiedAt)}</span>
    </div>
    <p class="alert-desc">${rule.description}</p>
    <p class="alert-agent">Agent: <strong>${agent.name}</strong></p>
  `;
  return li;
}

async function render(): Promise<void> {
  const [config, status, alerts] = await Promise.all([
    getConfig(),
    getConnectionStatus(),
    getRecentAlerts(),
  ]);

  const dot = document.getElementById('status-dot')!;
  const notConfigured = document.getElementById('not-configured')!;
  const disabledPanel = document.getElementById('disabled-panel')!;
  const mainPanel = document.getElementById('main-panel')!;
  const lastPoll = document.getElementById('last-poll')!;
  const alertsList = document.getElementById('alerts-list')!;
  const alertsEmpty = document.getElementById('alerts-empty')!;

  // Status dot
  const configured =
    config.mode === 'cloud' ? !!config.dashboardUrl : !!config.opensearchUrl && !!config.username;

  dot.className = 'status-dot';
  if (!configured) {
    dot.classList.add('status-unknown');
    dot.title = 'Not configured';
  } else if (!config.enabled) {
    dot.classList.add('status-disabled');
    dot.title = 'Disabled';
  } else if (status.connected) {
    dot.classList.add('status-ok');
    dot.title = 'Connected';
  } else {
    dot.classList.add('status-error');
    dot.title = status.error ?? 'Connection error';
  }

  // Panels
  const isConfigured =
    config.mode === 'cloud' ? !!config.dashboardUrl : !!config.opensearchUrl && !!config.username;

  if (!isConfigured) {
    notConfigured.classList.remove('hidden');
    return;
  }

  if (!config.enabled) {
    disabledPanel.classList.remove('hidden');
    return;
  }

  mainPanel.classList.remove('hidden');

  lastPoll.textContent = status.lastCheck
    ? `Last poll: ${timeAgo(status.lastCheck)}`
    : 'Last poll: never';

  alertsList.innerHTML = '';

  if (alerts.length === 0) {
    alertsEmpty.classList.remove('hidden');
  } else {
    alertsEmpty.classList.add('hidden');
    alerts.slice(0, 10).forEach((a) => alertsList.appendChild(renderAlert(a)));
  }

  // Clear badge
  await browser.runtime.sendMessage({ type: 'CLEAR_BADGE' });
}

document.addEventListener('DOMContentLoaded', async () => {
  await render();

  document.getElementById('btn-poll')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-poll') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '…';
    await browser.runtime.sendMessage({ type: 'POLL_NOW' });
    await new Promise((r) => setTimeout(r, 1200));
    await render();
    btn.disabled = false;
    btn.textContent = '↻';
  });

  const openOptions = () => browser.runtime.openOptionsPage();
  document.getElementById('btn-options')?.addEventListener('click', openOptions);
  document.getElementById('btn-open-options')?.addEventListener('click', openOptions);
  document.getElementById('btn-open-options-2')?.addEventListener('click', openOptions);

  document.getElementById('btn-clear')?.addEventListener('click', async () => {
    await clearRecentAlerts();
    await render();
  });
});
