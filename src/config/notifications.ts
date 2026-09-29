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