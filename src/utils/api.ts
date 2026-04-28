import type { ClusterConfig, Alert } from '../types';

interface OpenSearchResponse {
  hits: { hits: Alert[]; total: { value: number } };
}
interface DashboardSearchResponse {
  rawResponse: OpenSearchResponse;
}

function baseUrl(url: string) {
  return url.replace(/\/$/, '');
}

function basicAuth(u: string, p: string) {
  return `Basic ${btoa(`${u}:${p}`)}`;
}

function buildQuery(cluster: ClusterConfig, since: Date) {
  const must: unknown[] = [
    { range: { 'rule.level': { gte: cluster.minAlertLevel } } },
    { range: { '@timestamp': { gte: since.toISOString() } } },
  ];
  if (cluster.agentFilter.trim()) {
    must.push({ wildcard: { 'agent.name': { value: `*${cluster.agentFilter.trim()}*`, case_insensitive: true } } });
  }
  return { query: { bool: { must } }, sort: [{ '@timestamp': { order: 'desc' } }], size: 20 };
}

async function fetchSelfHosted(cluster: ClusterConfig, since: Date): Promise<Alert[]> {
  const res = await fetch(`${baseUrl(cluster.opensearchUrl)}/wazuh-alerts-*/_search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(cluster.username, cluster.password),
    },
    body: JSON.stringify(buildQuery(cluster, since)),
  });
  if (!res.ok) throw new Error(`OpenSearch ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as OpenSearchResponse).hits.hits;
}

async function fetchCloud(cluster: ClusterConfig, since: Date): Promise<Alert[]> {
  const res = await fetch(
    `${baseUrl(cluster.dashboardUrl)}/internal/search/opensearch-with-long-numerals`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'osd-xsrf': 'true' },
      credentials: 'include',
      body: JSON.stringify({ params: { index: 'wazuh-alerts-*', body: buildQuery(cluster, since) } }),
    }
  );
  if (res.status === 401 || res.status === 403)
    throw new Error('Not authenticated. Log into the Wazuh dashboard in this browser first.');
  if (!res.ok) throw new Error(`Dashboard API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as DashboardSearchResponse).rawResponse?.hits?.hits ?? [];
}

export function fetchAlerts(cluster: ClusterConfig, since: Date): Promise<Alert[]> {
  return cluster.mode === 'cloud' ? fetchCloud(cluster, since) : fetchSelfHosted(cluster, since);
}

export async function testConnection(
  cluster: ClusterConfig
): Promise<{ ok: boolean; error?: string; clusterName?: string }> {
  try {
    if (cluster.mode === 'cloud') {
      const res = await fetch(`${baseUrl(cluster.dashboardUrl)}/api/status`, {
        headers: { 'osd-xsrf': 'true' },
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403)
        return { ok: false, error: 'Not logged in — open the dashboard in Firefox first.' };
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = (await res.json()) as { name?: string };
      return { ok: true, clusterName: data.name ?? 'Wazuh Cloud' };
    } else {
      const res = await fetch(`${baseUrl(cluster.opensearchUrl)}/_cluster/health`, {
        headers: { Authorization: basicAuth(cluster.username, cluster.password) },
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = (await res.json()) as { cluster_name: string; status: string };
      return { ok: true, clusterName: `${data.cluster_name} (${data.status})` };
    }
  } catch (err) {
    const msg = (err as Error).message;
    return {
      ok: false,
      error: msg.includes('Failed to fetch')
        ? 'Cannot reach server. Check URL or accept the certificate first.'
        : msg,
    };
  }
}
