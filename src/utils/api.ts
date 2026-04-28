import type { Config, Alert } from '../types';

interface OpenSearchResponse {
  hits: { hits: Alert[]; total: { value: number } };
}

interface DashboardSearchResponse {
  rawResponse: OpenSearchResponse;
}

function baseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

function alertQuery(minLevel: number, since: Date) {
  return {
    query: {
      bool: {
        must: [
          { range: { 'rule.level': { gte: minLevel } } },
          { range: { '@timestamp': { gte: since.toISOString() } } },
        ],
      },
    },
    sort: [{ '@timestamp': { order: 'desc' } }],
    size: 20,
  };
}

// ── Self-hosted: direct OpenSearch query ─────────────────────────────────────

async function fetchSelfHosted(config: Config, since: Date): Promise<Alert[]> {
  const url = `${baseUrl(config.opensearchUrl)}/wazuh-alerts-*/_search`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(config.username, config.password),
    },
    body: JSON.stringify(alertQuery(config.minAlertLevel, since)),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenSearch ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as OpenSearchResponse;
  return data.hits.hits;
}

async function testSelfHosted(
  config: Config
): Promise<{ ok: boolean; error?: string; clusterName?: string }> {
  try {
    const response = await fetch(`${baseUrl(config.opensearchUrl)}/_cluster/health`, {
      headers: { Authorization: basicAuth(config.username, config.password) },
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const data = (await response.json()) as { cluster_name: string; status: string };
    return { ok: true, clusterName: `${data.cluster_name} (${data.status})` };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('Failed to fetch'))
      return { ok: false, error: 'Cannot reach server. Check URL and accept the certificate first.' };
    return { ok: false, error: msg };
  }
}

// ── Cloud: query via Wazuh Dashboard internal proxy ──────────────────────────

async function fetchCloud(config: Config, since: Date): Promise<Alert[]> {
  const url = `${baseUrl(config.dashboardUrl)}/internal/search/opensearch-with-long-numerals`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'osd-xsrf': 'true' },
    credentials: 'include',
    body: JSON.stringify({
      params: { index: 'wazuh-alerts-*', body: alertQuery(config.minAlertLevel, since) },
    }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Not authenticated. Open the Wazuh dashboard in this browser and log in.');
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dashboard API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as DashboardSearchResponse;
  return data.rawResponse?.hits?.hits ?? [];
}

async function testCloud(
  config: Config
): Promise<{ ok: boolean; error?: string; clusterName?: string }> {
  try {
    const response = await fetch(`${baseUrl(config.dashboardUrl)}/api/status`, {
      headers: { 'osd-xsrf': 'true' },
      credentials: 'include',
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'Not logged in. Open the Wazuh dashboard in Firefox and log in first.' };
    }
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const data = (await response.json()) as { name?: string };
    return { ok: true, clusterName: data.name ?? 'Wazuh Cloud' };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function fetchCriticalAlerts(config: Config, since: Date): Promise<Alert[]> {
  return config.mode === 'cloud' ? fetchCloud(config, since) : fetchSelfHosted(config, since);
}

export function testConnection(
  config: Config
): Promise<{ ok: boolean; error?: string; clusterName?: string }> {
  return config.mode === 'cloud' ? testCloud(config) : testSelfHosted(config);
}
