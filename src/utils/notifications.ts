import browser from 'webextension-polyfill';
import type { Alert } from '../types';

export async function sendAlertNotification(alert: Alert): Promise<void> {
  const { rule, agent } = alert._source;
  await browser.notifications.create(alert._id, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('icons/icon48.png'),
    title: `Wazuh — Level ${rule.level} Alert`,
    message: `${rule.description}\nAgent: ${agent.name} (${agent.id})`,
    priority: 2,
  });
}

export async function sendBatchNotification(count: number, maxLevel: number): Promise<void> {
  await browser.notifications.create(`wazuh-batch-${Date.now()}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('icons/icon48.png'),
    title: `Wazuh — ${count} New Critical Alerts`,
    message: `Highest level: ${maxLevel}. Click the extension icon for details.`,
    priority: 2,
  });
}
