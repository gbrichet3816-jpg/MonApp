// src/config/notifications.ts
// Configuration des notifications (permissions, listeners, planification)

import { Platform } from 'react-native';

let Notifications: any = null;
let Device: any = null;
let notificationsAvailable = false;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  notificationsAvailable = true;
} catch (e) {
  console.warn('expo-notifications non disponible dans Expo Go');
}

export function isNotificationsAvailable() {
  return notificationsAvailable;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsAvailable || !Device?.isDevice) {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Rappels',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2E6FB7',
    });
  }

  return true;
}

export async function scheduleNotification({
  title,
  body,
  date,
  data,
}: {
  title: string;
  body: string;
  date: Date;
  data?: Record<string, unknown>;
}) {
  if (!notificationsAvailable) {
    throw new Error('notifications-unavailable');
  }

  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
}

export async function cancelNotification(notificationId: string) {
  if (!notificationsAvailable) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function getAllScheduledNotifications() {
  if (!notificationsAvailable) return [];
  return await Notifications.getAllScheduledNotificationsAsync();
}

export async function cancelAllNotifications() {
  if (!notificationsAvailable) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ============================================================
// 🆕 LISTENERS POUR LES BRIEFINGS
// ============================================================

/**
 * Callback appelé quand une notification est TAPÉE par l'utilisateur.
 * Reçoit les données `data` de la notification.
 */
export type NotificationTapCallback = (data: Record<string, any>) => void;

/**
 * Callback appelé quand une notification est REÇUE en foreground
 * (app ouverte au moment où la notif arrive).
 */
export type NotificationReceivedCallback = (data: Record<string, any>) => void;

/**
 * Ajoute un listener pour les notifications TAPÉES.
 * Retourne une fonction pour retirer le listener.
 */
export function addNotificationTapListener(
  callback: NotificationTapCallback
): () => void {
  if (!notificationsAvailable) return () => {};

  const sub = Notifications.addNotificationResponseReceivedListener(
    (response: any) => {
      try {
        const data = response?.notification?.request?.content?.data || {};
        callback(data);
      } catch (e) {
        console.warn('[Notifications] Erreur listener tap:', e);
      }
    }
  );

  return () => sub.remove();
}

/**
 * Ajoute un listener pour les notifications REÇUES en foreground.
 * Retourne une fonction pour retirer le listener.
 */
export function addNotificationReceivedListener(
  callback: NotificationReceivedCallback
): () => void {
  if (!notificationsAvailable) return () => {};

  const sub = Notifications.addNotificationReceivedListener(
    (notification: any) => {
      try {
        const data = notification?.request?.content?.data || {};
        callback(data);
      } catch (e) {
        console.warn('[Notifications] Erreur listener received:', e);
      }
    }
  );

  return () => sub.remove();
}

/**
 * 🆕 Récupère les données de la notification qui a lancé l'app (cold start).
 * Utile quand l'app était fermée et que l'enfant tape la notif.
 */
export async function getInitialNotificationData(): Promise<Record<string, any> | null> {
  if (!notificationsAvailable) return null;

  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response?.notification?.request?.content?.data) {
      return response.notification.request.content.data;
    }
    return null;
  } catch (e) {
    console.warn('[Notifications] Erreur getInitialNotificationData:', e);
    return null;
  }
}

/**
 * 🆕 Efface la dernière notification reçue (pour éviter de la retraiter).
 */
export async function clearLastNotificationResponse(): Promise<void> {
  if (!notificationsAvailable) return;
  try {
    await Notifications.clearLastNotificationResponseAsync?.();
  } catch (e) {
    // Méthode pas toujours dispo
  }
}