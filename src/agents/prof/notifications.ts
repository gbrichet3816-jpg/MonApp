// src/agents/prof/notifications.ts
// Planification des notifications pour l'Agent Prof

import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';
import {
    disableEveningBriefing,
    disableMorningBriefing,
    enableEveningBriefing,
    enableMorningBriefing,
    getProfState,
} from './database';

// ============================================================
// RAPPEL DU MATIN
// ============================================================

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
        console.warn('[Prof] Impossible d\'annuler l\'ancienne notif matin:', e);
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
    console.warn('[Prof] Erreur planification briefing matin:', e);
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
    console.warn('[Prof] Erreur annulation briefing matin:', e);
  }
}

// ============================================================
// 🆕 RAPPEL DU SOIR
// ============================================================

/**
 * Calcule l'heure du rappel du soir selon le niveau de l'enfant.
 * - Primaire (cp_ce2, cm1_6e) : 17h30
 * - Collège/Lycée (5e_3e, lycee) : 18h30
 */
export function getDefaultEveningHour(level: string | null | undefined): { hour: number; minute: number } {
  if (!level) return { hour: 18, minute: 30 };

  if (level === 'cp_ce2' || level === 'cm1_6e') {
    return { hour: 17, minute: 30 };
  }
  // 5e_3e ou lycee
  return { hour: 18, minute: 30 };
}

export async function scheduleEveningBriefing(
  db: SQLite.SQLiteDatabase,
  userId: string,
  hour: number,
  minute: number
): Promise<{ notificationId: string } | null> {
  try {
    const state = await getProfState(db, userId);
    if (state.evening_briefing_notification_id) {
      try {
        await Notifications.cancelScheduledNotificationAsync(
          state.evening_briefing_notification_id
        );
      } catch (e) {
        console.warn('[Prof] Impossible d\'annuler l\'ancienne notif soir:', e);
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
        title: 'Ce soir avec Prof 🌙',
        body: 'Regarde ce que Prof a préparé pour toi',
        data: { agentId: 'prof', type: 'evening_briefing' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    await enableEveningBriefing(db, userId, hour, minute, notificationId);
    return { notificationId };
  } catch (e) {
    console.warn('[Prof] Erreur planification briefing soir:', e);
    return null;
  }
}

export async function cancelEveningBriefing(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<void> {
  try {
    const state = await getProfState(db, userId);
    if (state.evening_briefing_notification_id) {
      await Notifications.cancelScheduledNotificationAsync(
        state.evening_briefing_notification_id
      );
    }
    await disableEveningBriefing(db, userId);
  } catch (e) {
    console.warn('[Prof] Erreur annulation briefing soir:', e);
  }
}

// ============================================================
// VÉRIFICATIONS GLOBALES
// ============================================================

export async function ensureBriefingsScheduled(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<void> {
  try {
    const state = await getProfState(db, userId);
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    // Vérif briefing matin
    if (state.morning_briefing_enabled && state.morning_briefing_notification_id) {
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
    }

    // Vérif briefing soir
    if (state.evening_briefing_enabled && state.evening_briefing_notification_id) {
      const exists = scheduled.some(
        (n) => n.identifier === state.evening_briefing_notification_id
      );
      if (!exists) {
        await scheduleEveningBriefing(
          db,
          userId,
          state.evening_briefing_hour,
          state.evening_briefing_minute
        );
      }
    }
  } catch (e) {
    console.warn('[Prof] Erreur vérification briefings:', e);
  }
}

// Ancien nom conservé pour compatibilité avec index.tsx
export const ensureMorningBriefingScheduled = ensureBriefingsScheduled;