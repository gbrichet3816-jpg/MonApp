// src/agents/prof/notifications.ts
// Planification des notifications pour l'Agent Prof

import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';
import {
    disableMorningBriefing,
    enableMorningBriefing,
    getProfState,
} from './database';

const MORNING_NOTIFICATION_KEY = 'prof-morning-briefing';

export async function scheduleMorningBriefing(
  db: SQLite.SQLiteDatabase,
  userId: string,
  hour: number,
  minute: number
): Promise<{ notificationId: string } | null> {
  try {
    const state = await getProfState(db, userId);
    if (state.morning_briefing_notification_id) {
      try {
        await Notifications.cancelScheduledNotificationAsync(
          state.morning_briefing_notification_id
        );
      } catch (e) {
        console.warn('[Prof] Impossible d\'annuler l\'ancienne notif:', e);
      }
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        console.warn('[Prof] Permissions notifications refusées');
        return null;
      }
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Bonjour ! 👋',
        body: 'Regarde ton emploi du temps du jour dans Prof 📅',
        data: { agentId: 'prof', type: 'morning_briefing' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    await enableMorningBriefing(db, userId, hour, minute, notificationId);

    return { notificationId };
  } catch (e) {
    console.warn('[Prof] Erreur planification briefing:', e);
    return null;
  }
}

export async function cancelMorningBriefing(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<void> {
  try {
    const state = await getProfState(db, userId);
    if (state.morning_briefing_notification_id) {
      await Notifications.cancelScheduledNotificationAsync(
        state.morning_briefing_notification_id
      );
    }
    await disableMorningBriefing(db, userId);
  } catch (e) {
    console.warn('[Prof] Erreur annulation briefing:', e);
  }
}

export async function ensureMorningBriefingScheduled(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<void> {
  try {
    const state = await getProfState(db, userId);
    if (!state.morning_briefing_enabled) return;
    if (!state.morning_briefing_notification_id) return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const exists = scheduled.some(
      (n) => n.identifier === state.morning_briefing_notification_id
    );

    if (!exists) {
      await scheduleMorningBriefing(
        db,
        userId,
        state.morning_briefing_hour,
        state.morning_briefing_minute
      );
    }
  } catch (e) {
    console.warn('[Prof] Erreur vérification briefing:', e);
  }
}