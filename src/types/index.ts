export type ConnectionMode = 'selfhosted' | 'cloud';

export interface ClusterConfig {
  id: string;
  name: string;
  mode: ConnectionMode;
  // Self-hosted
  opensearchUrl: string;
  username: string;
  password: string;
  // Cloud
  dashboardUrl: string;
  // Per-cluster settings
  pollIntervalMinutes: number;
  minAlertLevel: number;
  agentFilter: string;
  enabled: boolean;
}

export interface AppConfig {
  clusters: ClusterConfig[];
  soundEnabled: boolean;
}

export interface AlertSource {
  '@timestamp': string;
  rule: {
    level: number;
    description: string;
    id: string;
    groups?: string[];
  };
  agent: { name: string; id: string; ip?: string };
  location?: string;
  full_log?: string;
  data?: Record<string, unknown>;
}

export interface Alert {
  _id: string;
  _index: string;
  _source: AlertSource;
}

export interface StoredAlert extends Alert {
  notifiedAt: number;
  clusterId: string;
  clusterName: string;
}

export interface ConnectionStatus {
  connected: boolean;
  lastCheck: number;
  error?: string;
}

export type MessageType =
  | { type: 'CONFIG_UPDATED' }
  | { type: 'POLL_NOW' }
  | { type: 'CLEAR_BADGE' };
