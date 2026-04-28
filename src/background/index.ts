import browser from 'webextension-polyfill';
import { fetchAlerts } from '../utils/api';
import {
  getAppConfig,
  getSeenIds,
  addSeenIds,
  addRecentAlerts,
  saveConnectionStatus,
  getLastPollTimes,
  saveLastPollTime,
} from '../utils/storage';
import { sendAlertNotification, sendBatchNotification } from '../utils/notifications';
import { playNotificationBeep } from '../utils/sound';
import type { StoredAlert, MessageType } from '../types';

const ALARM_NAME = 'wazuh-poll';

async function pollAllClusters(): Promise<void> {
  const { clusters, soundEnabled } = await getAppConfig();
  const enabledClusters = clusters.filter((c) => c.enabled);
  if (enabledClusters.length === 0) return;

  const seenIds = await getSeenIds();
  const lastPollTimes = await getLastPollTimes();
  let totalNew = 0;

  for (const cluster of enabledClusters) {
    try {
      const lastPoll = lastPollTimes[cluster.id] ?? 0;
      const lookback = cluster.pollIntervalMinutes * 60 * 1000;
      const since = new Date(lastPoll ? lastPoll - 5000 : Date.now() - lookback);

      const alerts = await fetchAlerts(cluster, since);
      await saveConnectionStatus(cluster.id, { connected: true, lastCheck: Date.now() });
      await saveLastPollTime(cluster.id, Date.now());

      const newAlerts = alerts.filter((a) => !seenIds.has(a._id));
      if (newAlerts.length === 0) continue;

      newAlerts.forEach((a) => seenIds.add(a._id));

      const stored: StoredAlert[] = newAlerts.map((a) => ({
        ...a,
        notifiedAt: Date.now(),
        clusterId: cluster.id,
        clusterName: cluster.name,
      }));
      await addRecentAlerts(stored);
      totalNew += newAlerts.length;

      if (newAlerts.length === 1) {
        await sendAlertNotification(newAlerts[0], cluster.name);
      } else {
        const maxLevel = Math.max(...newAlerts.map((a) => a._source.rule.level));
        await sendBatchNotification(newAlerts.length, maxLevel, cluster.name);
      }
    } catch (err) {
      await saveConnectionStatus(cluster.id, {
        connected: false,
        lastCheck: Date.now(),
        error: (err as Error).message,
      });
    }
  }

  await addSeenIds(Array.from(seenIds));

  if (totalNew > 0) {
    const badge = totalNew > 9 ? '9+' : String(totalNew);
    await browser.action.setBadgeText({ text: badge });
    await browser.action.setBadgeBackgroundColor({ color: '#ef4444' });
    if (soundEnabled) playNotificationBeep();
  }
}

async function setupAlarm(): Promise<void> {
  const { clusters } = await getAppConfig();
  const intervals = clusters.filter((c) => c.enabled).map((c) => c.pollIntervalMinutes);
  const minInterval = intervals.length > 0 ? Math.max(1, Math.min(...intervals)) : 2;
  await browser.alarms.clear(ALARM_NAME);
  await browser.alarms.create(ALARM_NAME, { periodInMinutes: minInterval, delayInMinutes: 0 });
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) await pollAllClusters();
});

browser.runtime.onInstalled.addListener(async () => {
  const { clusters } = await getAppConfig();
  if (clusters.some((c) => c.enabled)) await setupAlarm();
});

browser.runtime.onStartup.addListener(async () => {
  const { clusters } = await getAppConfig();
  if (clusters.some((c) => c.enabled)) await setupAlarm();
});

browser.runtime.onMessage.addListener(async (message: unknown) => {
  const msg = message as MessageType;
  switch (msg.type) {
    case 'CONFIG_UPDATED': {
      const { clusters } = await getAppConfig();
      if (clusters.some((c) => c.enabled)) {
        await setupAlarm();
        await pollAllClusters();
      } else {
        await browser.alarms.clear(ALARM_NAME);
        await browser.action.setBadgeText({ text: '' });
      }
      break;
    }
    case 'POLL_NOW':
      await pollAllClusters();
      break;
    case 'CLEAR_BADGE':
      await browser.action.setBadgeText({ text: '' });
      break;
  }
});
