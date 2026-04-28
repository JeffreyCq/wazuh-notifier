import browser from 'webextension-polyfill';
import './options.css';
import { getConfig, saveConfig, DEFAULT_CONFIG } from '../utils/storage';
import { testConnection } from '../utils/api';
import type { Config } from '../types';

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function readForm(): Config {
  return {
    opensearchUrl: el<HTMLInputElement>('opensearch-url').value.trim(),
    username: el<HTMLInputElement>('username').value.trim(),
    password: el<HTMLInputElement>('password').value,
    pollIntervalMinutes: Math.max(1, parseInt(el<HTMLInputElement>('poll-interval').value, 10) || 2),
    minAlertLevel: parseInt(el<HTMLInputElement>('min-level').value, 10),
    enabled: el<HTMLInputElement>('enabled').checked,
  };
}

function populateForm(config: Config): void {
  el<HTMLInputElement>('opensearch-url').value = config.opensearchUrl;
  el<HTMLInputElement>('username').value = config.username;
  el<HTMLInputElement>('password').value = config.password;
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

  // Level slider live preview
  el<HTMLInputElement>('min-level').addEventListener('input', (e) => {
    el('level-value').textContent = (e.target as HTMLInputElement).value;
  });

  // Show/hide password
  el('toggle-password').addEventListener('click', () => {
    const input = el<HTMLInputElement>('password');
    const btn = el<HTMLButtonElement>('toggle-password');
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
    }
  });

  // Test connection
  el('btn-test').addEventListener('click', async () => {
    const btn = el<HTMLButtonElement>('btn-test');
    btn.disabled = true;
    btn.textContent = 'Testing…';
    showTestResult('', true);

    const current = readForm();
    if (!current.opensearchUrl || !current.username) {
      showTestResult('Fill in URL and username first.', false);
      btn.disabled = false;
      btn.textContent = 'Test Connection';
      return;
    }

    const result = await testConnection(current);
    if (result.ok) {
      showTestResult(`✓ Connected — ${result.clusterName}`, true);
    } else {
      showTestResult(`✗ ${result.error}`, false);
    }

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
