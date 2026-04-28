import browser from 'webextension-polyfill';
import type { ClusterConfig, AppConfig, StoredAlert, ConnectionStatus } from '../types';

export function makeCluster(overrides: Partial<ClusterConfig> = {}): ClusterConfig {
  return {
    id: crypto.randomUUID(),
    name: 'My Cluster',
    mode: 'selfhosted',
    opensearchUrl: '',
    username: '',
    password: '',
    dashboardUrl: '',
    pollIntervalMinutes: 2,
    minAlertLevel: 12,
    agentFilter: '',
    enabled: false,
    ...overrides,
  };
}

export const DEFAULT_APP_CONFIG: AppConfig = { clusters: [], soundEnabled: true };

// Migrate from old single-Config storage format
async function migrateIfNeeded(): Promise<void> {
  const raw = await browser.storage.local.get(['config', 'appConfig']);
  if (raw['appConfig'] || !raw['config']) return;
  const old = raw['config'] as Record<string, unknown>;
  const cluster = makeCluster({
    name: 'My Wazuh',
    mode: (old['mode'] as ClusterConfig['mode']) ?? 'selfhosted',
    opensearchUrl: (old['opensearchUrl'] as string) ?? '',
    username: (old['username'] as string) ?? '',
    password: (old['password'] as string) ?? '',
    dashboardUrl: (old['dashboardUrl'] as string) ?? '',
    pollIntervalMinutes: (old['pollIntervalMinutes'] as number) ?? 2,
    minAlertLevel: (old['minAlertLevel'] as number) ?? 12,
    enabled: (old['enabled'] as boolean) ?? false,
  });
  await browser.storage.local.set({ appConfig: { clusters: [cluster], soundEnabled: true } });
  await browser.storage.local.remove('config');
}

export async function getAppConfig(): Promise<AppConfig> {
  await migrateIfNeeded();
  const result = await browser.storage.local.get('appConfig');
  return { ...DEFAULT_APP_CONFIG, ...(result['appConfig'] as AppConfig | undefined) };
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  await browser.storage.local.set({ appConfig: config });
}

export async function getSeenIds(): Promise<Set<string>> {
  const result = await browser.storage.local.get('seenIds');
  return new Set((result['seenIds'] as string[] | undefined) ?? []);
}

export async function addSeenIds(ids: string[]): Promise<void> {
  const current = await getSeenIds();
  ids.forEach((id) => current.add(id));
  await browser.storage.local.set({ seenIds: Array.from(current).slice(-500) });
}

export async function getRecentAlerts(): Promise<StoredAlert[]> {
  const result = await browser.storage.local.get('recentAlerts');
  return (result['recentAlerts'] as StoredAlert[] | undefined) ?? [];
}

export async function addRecentAlerts(alerts: StoredAlert[]): Promise<void> {
  const current = await getRecentAlerts();
  await browser.storage.local.set({ recentAlerts: [...alerts, ...current].slice(0, 100) });
}

export async function clearRecentAlerts(): Promise<void> {
  await browser.storage.local.set({ recentAlerts: [] });
}

export async function getConnectionStatuses(): Promise<Record<string, ConnectionStatus>> {
  const result = await browser.storage.local.get('connectionStatuses');
  return (result['connectionStatuses'] as Record<string, ConnectionStatus> | undefined) ?? {};
}

export async function saveConnectionStatus(clusterId: string, status: ConnectionStatus): Promise<void> {
  const all = await getConnectionStatuses();
  all[clusterId] = status;
  await browser.storage.local.set({ connectionStatuses: all });
}

export async function getLastPollTimes(): Promise<Record<string, number>> {
  const result = await browser.storage.local.get('lastPollTimes');
  return (result['lastPollTimes'] as Record<string, number> | undefined) ?? {};
}

export async function saveLastPollTime(clusterId: string, time: number): Promise<void> {
  const all = await getLastPollTimes();
  all[clusterId] = time;
  await browser.storage.local.set({ lastPollTimes: all });
}
