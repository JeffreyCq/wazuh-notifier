import browser from 'webextension-polyfill';
import { fetchCriticalAlerts } from '../utils/api';
import {
  getConfig,
  getSeenIds,
  addSeenIds,
  addRecentAlerts,
  saveConnectionStatus,
  getLastPollTime,
  saveLastPollTime,
} from '../utils/storage';
import { sendAlertNotification, sendBatchNotification } from '../utils/notifications';
import type { StoredAlert, MessageType } from '../types';

const ALARM_NAME = 'wazuh-poll';

async function poll(): Promise<void> {
  const config = await getConfig();

  if (!config.enabled || !config.opensearchUrl || !config.username) return;

  try {
    const lastPollTime = await getLastPollTime();
    const lookback = config.pollIntervalMinutes * 60 * 1000;
    const since = new Date(lastPollTime ? lastPollTime - 5000 : Date.now() - lookback);

    const alerts = await fetchCriticalAlerts(config, since);

    await saveConnectionStatus({ connected: true, lastCheck: Date.now() });
    await saveLastPollTime(Date.now());

    if (alerts.length === 0) return;

    const seenIds = await getSeenIds();
    const newAlerts = alerts.filter((a) => !seenIds.has(a._id));

    if (newAlerts.length === 0) return;

    await addSeenIds(newAlerts.map((a) => a._id));

    const stored: StoredAlert[] = newAlerts.map((a) => ({ ...a, notifiedAt: Date.now() }));
    await addRecentAlerts(stored);

    if (newAlerts.length === 1) {
      await sendAlertNotification(newAlerts[0]);
    } else {
      const maxLevel = Math.max(...newAlerts.map((a) => a._source.rule.level));
      await sendBatchNotification(newAlerts.length, maxLevel);
    }

    const badgeText = newAlerts.length > 9 ? '9+' : String(newAlerts.length);
    await browser.action.setBadgeText({ text: badgeText });
    await browser.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } catch (err) {
    await saveConnectionStatus({
      connected: false,
      lastCheck: Date.now(),
      error: (err as Error).message,
    });
  }
}

async function setupAlarm(intervalMinutes: number): Promise<void> {
  await browser.alarms.clear(ALARM_NAME);
  await browser.alarms.create(ALARM_NAME, {
    periodInMinutes: Math.max(1, intervalMinutes),
    delayInMinutes: 0,
  });
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) await poll();
});

browser.runtime.onInstalled.addListener(async () => {
  const config = await getConfig();
  if (config.enabled) await setupAlarm(config.pollIntervalMinutes);
});

browser.runtime.onStartup.addListener(async () => {
  const config = await getConfig();
  if (config.enabled) await setupAlarm(config.pollIntervalMinutes);
});

browser.runtime.onMessage.addListener(async (message: unknown) => {
  const msg = message as MessageType;
  switch (msg.type) {
    case 'CONFIG_UPDATED': {
      const config = await getConfig();
      if (config.enabled) {
        await setupAlarm(config.pollIntervalMinutes);
        await poll();
      } else {
        await browser.alarms.clear(ALARM_NAME);
        await browser.action.setBadgeText({ text: '' });
      }
      break;
    }
    case 'POLL_NOW':
      await poll();
      break;
    case 'CLEAR_BADGE':
      await browser.action.setBadgeText({ text: '' });
      break;
  }
});
