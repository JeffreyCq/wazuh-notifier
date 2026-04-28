import type { Config, Alert } from '../types';

interface OpenSearchResponse {
  hits: {
    hits: Alert[];
    total: { value: number; relation: string };
  };
}

function buildAuthHeader(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

function baseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

export async function fetchCriticalAlerts(config: Config, since: Date): Promise<Alert[]> {
  const url = `${baseUrl(config.opensearchUrl)}/wazuh-alerts-*/_search`;

  const body = {
    query: {
      bool: {
        must: [
          { range: { 'rule.level': { gte: config.minAlertLevel } } },
          { range: { '@timestamp': { gte: since.toISOString() } } },
        ],
      },
    },
    sort: [{ '@timestamp': { order: 'desc' } }],
    size: 20,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthHeader(config.username, config.password),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenSearch ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as OpenSearchResponse;
  return data.hits.hits;
}

export async function testConnection(
  config: Config
): Promise<{ ok: boolean; error?: string; clusterName?: string }> {
  try {
    const response = await fetch(`${baseUrl(config.opensearchUrl)}/_cluster/health`, {
      headers: { Authorization: buildAuthHeader(config.username, config.password) },
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as { cluster_name: string; status: string };
    return { ok: true, clusterName: `${data.cluster_name} (${data.status})` };
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('Failed to fetch')) {
      return {
        ok: false,
        error: 'Cannot reach the server. Check the URL and make sure the certificate is trusted.',
      };
    }
    return { ok: false, error: message };
  }
}
