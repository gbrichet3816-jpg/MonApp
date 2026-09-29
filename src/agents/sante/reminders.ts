import { cancelNotification, scheduleNotification } from '@/config/notifications';

export type MedicationReminder = {
  id: string;
  medicationName: string;
  time: string;
  notificationId?: string;
  active: boolean;
};

export async function scheduleMedicationReminder({
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
      categoryIdentifier: 'medication-reminder',
      data: {
        type: 'medication-reminder',
        reminderId,
        medicationName,
      },
    });

    return notificationId;
  } catch (error) {
    console.error('Erreur programmation rappel:', error);
    return null;
  }
}

export async function cancelMedicationReminder(notificationId: string) {
  try {
    await cancelNotification(notificationId);
  } catch (error) {
    console.error('Erreur annulation rappel:', error);
  }
}

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