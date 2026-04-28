import browser from 'webextension-polyfill';
import type { Config, StoredAlert, ConnectionStatus } from '../types';

export const DEFAULT_CONFIG: Config = {
  mode: 'selfhosted',
  opensearchUrl: '',
  username: '',
  password: '',
  dashboardUrl: '',
  pollIntervalMinutes: 2,
  minAlertLevel: 12,
  enabled: false,
};

export async function getConfig(): Promise<Config> {
  const result = await browser.storage.local.get('config');
  return { ...DEFAULT_CONFIG, ...(result['config'] as Config | undefined) };
}

export async function saveConfig(config: Config): Promise<void> {
  await browser.storage.local.set({ config });
}

export async function getSeenIds(): Promise<Set<string>> {
  const result = await browser.storage.local.get('seenIds');
  return new Set((result['seenIds'] as string[] | undefined) ?? []);
}

export async function addSeenIds(ids: string[]): Promise<void> {
  const current = await getSeenIds();
  ids.forEach((id) => current.add(id));
  // Keep only last 500 entries to avoid storage bloat
  const trimmed = Array.from(current).slice(-500);
  await browser.storage.local.set({ seenIds: trimmed });
}

export async function getRecentAlerts(): Promise<StoredAlert[]> {
  const result = await browser.storage.local.get('recentAlerts');
  return (result['recentAlerts'] as StoredAlert[] | undefined) ?? [];
}

export async function addRecentAlerts(alerts: StoredAlert[]): Promise<void> {
  const current = await getRecentAlerts();
  const combined = [...alerts, ...current].slice(0, 50);
  await browser.storage.local.set({ recentAlerts: combined });
}

export async function clearRecentAlerts(): Promise<void> {
  await browser.storage.local.set({ recentAlerts: [] });
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const result = await browser.storage.local.get('connectionStatus');
  return (
    (result['connectionStatus'] as ConnectionStatus | undefined) ?? {
      connected: false,
      lastCheck: 0,
    }
  );
}

export async function saveConnectionStatus(status: ConnectionStatus): Promise<void> {
  await browser.storage.local.set({ connectionStatus: status });
}

export async function getLastPollTime(): Promise<number> {
  const result = await browser.storage.local.get('lastPollTime');
  return (result['lastPollTime'] as number | undefined) ?? 0;
}

export async function saveLastPollTime(time: number): Promise<void> {
  await browser.storage.local.set({ lastPollTime: time });
}
