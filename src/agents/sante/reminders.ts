import {
  cancelNotification,
  scheduleNotification,
} from '@/config/notifications';

export type MedicationReminder = {
  id: string;
  medicationName: string;
  time: string;
  notificationId?: string;
  active: boolean;
};

// ===== PROGRAMMATION DE RAPPELS =====

// Rappel QUOTIDIEN (récurrent à heure fixe)
export async function scheduleDailyReminder({
  medicationName,
  time,
  reminderId,
}: {
  medicationName: string;
  time: string;
  reminderId: string;
}): Promise<string | null> {
  try {
    const [hours, minutes] = time.split(':').map(Number);

    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const notificationId = await scheduleNotification({
      title: '💊 Rappel de médicament',
      body: `C'est l'heure de prendre : ${medicationName}`,
      date: target,
      data: {
        type: 'medication-reminder',
        reminderId,
        medicationName,
        reminderType: 'daily',
      },
    });

    return notificationId;
  } catch (error) {
    console.error('Erreur programmation rappel quotidien:', error);
    return null;
  }
}

// Plusieurs rappels QUOTIDIENS d'un coup
export async function scheduleMultipleDailyReminders({
  medicationName,
  times,
  baseId,
}: {
  medicationName: string;
  times: string[];
  baseId: string;
}): Promise<{ time: string; notificationId: string; reminderId: string }[]> {
  const results: { time: string; notificationId: string; reminderId: string }[] = [];

  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    const reminderId = `${baseId}-${i}`;

    const notificationId = await scheduleDailyReminder({
      medicationName,
      time,
      reminderId,
    });

    if (notificationId) {
      results.push({ time, notificationId, reminderId });
    }
  }

  return results;
}

// Rappel UNIQUE (une seule fois à une date précise)
export async function scheduleOneTimeReminder({
  medicationName,
  dateTime,
  reminderId,
}: {
  medicationName: string;
  dateTime: string;
  reminderId: string;
}): Promise<{ notificationId: string | null; scheduledAt: number | null }> {
  try {
    const target = new Date(dateTime);

    if (isNaN(target.getTime()) || target.getTime() <= Date.now()) {
      console.warn('Date invalide ou passée:', dateTime);
      return { notificationId: null, scheduledAt: null };
    }

    const notificationId = await scheduleNotification({
      title: '💊 Rappel de médicament',
      body: `C'est l'heure de prendre : ${medicationName}`,
      date: target,
      data: {
        type: 'medication-reminder',
        reminderId,
        medicationName,
        reminderType: 'onetime',
      },
    });

    return { notificationId, scheduledAt: target.getTime() };
  } catch (error) {
    console.error('Erreur programmation rappel unique:', error);
    return { notificationId: null, scheduledAt: null };
  }
}

// Plusieurs rappels UNIQUES d'un coup
export async function scheduleMultipleOneTimeReminders({
  medicationName,
  dateTimes,
  baseId,
}: {
  medicationName: string;
  dateTimes: string[];
  baseId: string;
}): Promise<{ dateTime: string; notificationId: string; reminderId: string; scheduledAt: number }[]> {
  const results: { dateTime: string; notificationId: string; reminderId: string; scheduledAt: number }[] = [];

  for (let i = 0; i < dateTimes.length; i++) {
    const dateTime = dateTimes[i];
    const reminderId = `${baseId}-${i}`;

    const { notificationId, scheduledAt } = await scheduleOneTimeReminder({
      medicationName,
      dateTime,
      reminderId,
    });

    if (notificationId && scheduledAt) {
      results.push({ dateTime, notificationId, reminderId, scheduledAt });
    }
  }

  return results;
}

// Rappel RELATIF (dans X minutes)
export async function scheduleRelativeReminder({
  medicationName,
  minutesFromNow,
  reminderId,
}: {
  medicationName: string;
  minutesFromNow: number;
  reminderId: string;
}): Promise<{ notificationId: string | null; scheduledAt: number | null }> {
  try {
    const target = new Date(Date.now() + minutesFromNow * 60 * 1000);

    const notificationId = await scheduleNotification({
      title: '💊 Rappel de médicament',
      body: `C'est l'heure de prendre : ${medicationName}`,
      date: target,
      data: {
        type: 'medication-reminder',
        reminderId,
        medicationName,
        reminderType: 'relative',
      },
    });

    return { notificationId, scheduledAt: target.getTime() };
  } catch (error) {
    console.error('Erreur programmation rappel relatif:', error);
    return { notificationId: null, scheduledAt: null };
  }
}

// Annule un rappel par notification ID
export async function cancelMedicationReminder(notificationId: string) {
  try {
    await cancelNotification(notificationId);
  } catch (error) {
    console.error('Erreur annulation rappel:', error);
  }
}

// ===== PARSERS (fallback si DeepSeek ne détecte pas) =====

export function parseTimeFromMessage(message: string): string | null {
  const regex = /(\d{1,2})\s*[h:]\s*(\d{0,2})/;
  const match = message.match(regex);

  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function parseMedicationFromMessage(message: string): string | null {
  const stopWords = [
    'à', 'a', 'de', 'du', 'le', 'la', 'les', 'un', 'une',
    'prendre', 'prend', 'mon', 'ma', 'mes', 'pour', 'vers',
  ];

  const prendreMatch = message.match(
    /(?:prendre|prend)\s+(?:le|la|mon|ma|mes|du|de\s+la)?\s*([a-zA-Zéèêàçùôî]+)/i,
  );
  if (prendreMatch && prendreMatch[1]) {
    const candidate = prendreMatch[1].trim().toLowerCase();
    if (!stopWords.includes(candidate)) {
      return prendreMatch[1].trim();
    }
  }

  const medMatch = message.match(/médicament\s*:?\s*([a-zA-Zéèêàçùôî]+)/i);
  if (medMatch && medMatch[1]) {
    const candidate = medMatch[1].trim().toLowerCase();
    if (!stopWords.includes(candidate)) {
      return medMatch[1].trim();
    }
  }

  const capitalMatch = message.match(
    /(?:prendre|prend|rappel\S*)\s+([A-Z][a-zA-Zéèêàçùôî]+)/,
  );
  if (capitalMatch && capitalMatch[1]) {
    return capitalMatch[1];
  }

  return null;
}