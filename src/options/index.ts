import browser from 'webextension-polyfill';
import './options.css';
import { getConfig, saveConfig, DEFAULT_CONFIG } from '../utils/storage';
import { testConnection } from '../utils/api';
import type { Config, ConnectionMode } from '../types';

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function setMode(mode: ConnectionMode): void {
  document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset['mode'] === mode);
  });
  el('section-selfhosted').classList.toggle('hidden', mode !== 'selfhosted');
  el('section-cloud').classList.toggle('hidden', mode !== 'cloud');
}

function readForm(): Config {
  const mode = (document.querySelector<HTMLButtonElement>('.mode-tab.active')?.dataset['mode'] ??
    'selfhosted') as ConnectionMode;
  return {
    mode,
    opensearchUrl: el<HTMLInputElement>('opensearch-url').value.trim(),
    username: el<HTMLInputElement>('username').value.trim(),
    password: el<HTMLInputElement>('password').value,
    dashboardUrl: el<HTMLInputElement>('dashboard-url').value.trim(),
    pollIntervalMinutes: Math.max(1, parseInt(el<HTMLInputElement>('poll-interval').value, 10) || 2),
    minAlertLevel: parseInt(el<HTMLInputElement>('min-level').value, 10),
    enabled: el<HTMLInputElement>('enabled').checked,
  };
}

function populateForm(config: Config): void {
  setMode(config.mode);
  el<HTMLInputElement>('opensearch-url').value = config.opensearchUrl;
  el<HTMLInputElement>('username').value = config.username;
  el<HTMLInputElement>('password').value = config.password;
  el<HTMLInputElement>('dashboard-url').value = config.dashboardUrl;
  el<HTMLInputElement>('poll-interval').value = String(config.pollIntervalMinutes);
  el<HTMLInputElement>('min-level').value = String(config.minAlertLevel);
  el<HTMLInputElement>('enabled').checked = config.enabled;
  el('level-value').textContent = String(config.minAlertLevel);
}

function showTestResult(msg: string, ok: boolean): void {
  const span = el('test-result');
  span.textContent = msg;
  span.className = `test-result ${ok ? 'result-ok' : 'result-error'}`;
}

function showSaveStatus(msg: string, ok: boolean): void {
  const span = el('save-status');
  span.textContent = msg;
  span.className = `save-status ${ok ? 'result-ok' : 'result-error'}`;
  setTimeout(() => { span.textContent = ''; }, 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
  const config = await getConfig();
  populateForm({ ...DEFAULT_CONFIG, ...config });

  // Mode tabs
  document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset['mode'] as ConnectionMode));
  });

  // Level slider
  el<HTMLInputElement>('min-level').addEventListener('input', (e) => {
    el('level-value').textContent = (e.target as HTMLInputElement).value;
  });

  // Show/hide password
  el('toggle-password').addEventListener('click', () => {
    const input = el<HTMLInputElement>('password');
    const btn = el<HTMLButtonElement>('toggle-password');
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.textContent = isHidden ? 'Hide' : 'Show';
  });

  // Test connection
  el('btn-test').addEventListener('click', async () => {
    const btn = el<HTMLButtonElement>('btn-test');
    btn.disabled = true;
    btn.textContent = 'Testing…';
    showTestResult('', true);

    const current = readForm();
    const needsUrl = current.mode === 'cloud' ? !current.dashboardUrl : !current.opensearchUrl;
    if (needsUrl) {
      showTestResult('Enter the URL first.', false);
      btn.disabled = false;
      btn.textContent = 'Test Connection';
      return;
    }

    const result = await testConnection(current);
    showTestResult(result.ok ? `✓ ${result.clusterName}` : `✗ ${result.error}`, result.ok);
    btn.disabled = false;
    btn.textContent = 'Test Connection';
  });

  // Save
  el('btn-save').addEventListener('click', async () => {
    const btn = el<HTMLButtonElement>('btn-save');
    btn.disabled = true;
    const newConfig = readForm();
    await saveConfig(newConfig);
    await browser.runtime.sendMessage({ type: 'CONFIG_UPDATED' });
    showSaveStatus('✓ Saved', true);
    btn.disabled = false;
  });
});
