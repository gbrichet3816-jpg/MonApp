import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { saveReminderResponse } from './database';

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

export async function setupMedicationCategory() {
  if (!notificationsAvailable) return;

  await Notifications.setNotificationCategoryAsync('medication-reminder', [
    {
      identifier: 'taken',
      buttonTitle: 'Oui, pris',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'not_taken',
      buttonTitle: 'Non',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'later',
      buttonTitle: 'Plus tard',
      options: { opensAppToForeground: false },
    },
  ]);
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
  categoryIdentifier,
}: {
  title: string;
  body: string;
  date: Date;
  data?: Record<string, unknown>;
  categoryIdentifier?: string;
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
      categoryIdentifier,
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

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

export function registerNotificationTask() {
  if (!notificationsAvailable) return;

  TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }: any) => {
    if (error) {
      console.error('Erreur tâche notification:', error);
      return;
    }

    if (data) {
      const actionIdentifier = data.actionIdentifier;
      const notificationData = data.notification?.data;

      console.log('📬 Réponse notification:', actionIdentifier, notificationData);

      if (notificationData?.type === 'medication-reminder' && notificationData?.reminderId) {
        saveReminderResponse({
          reminderId: notificationData.reminderId,
          response: actionIdentifier,
        });

        if (actionIdentifier === 'later') {
          const newDate = new Date(Date.now() + 30 * 60 * 1000);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '💊 Rappel de médicament',
              body: `C'est l'heure de prendre : ${notificationData.medicationName}`,
              data: notificationData,
              categoryIdentifier: 'medication-reminder',
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: newDate,
            },
          });
        }
      }
    }
  });

  Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((err: any) => {
    console.warn('Impossible d\'enregistrer la tâche:', err);
  });
}