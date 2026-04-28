export interface Config {
  opensearchUrl: string;
  username: string;
  password: string;
  pollIntervalMinutes: number;
  minAlertLevel: number;
  enabled: boolean;
}

export interface AlertSource {
  '@timestamp': string;
  rule: {
    level: number;
    description: string;
    id: string;
    groups?: string[];
  };
  agent: {
    name: string;
    id: string;
    ip?: string;
  };
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
