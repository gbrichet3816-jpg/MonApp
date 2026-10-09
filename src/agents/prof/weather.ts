// src/agents/prof/weather.ts
// Récupération et cache de la météo pour l'Agent Prof

import * as SQLite from 'expo-sqlite';
import {
  cacheWeather,
  getCachedWeather,
} from './database';

const API_BASE_URL = 'https://monapp-server-production.up.railway.app';

/**
 * Structure des données météo renvoyées par le serveur.
 * 🆕 Contient maintenant les prévisions sur 3 jours.
 */
export interface WeatherData {
  city: string;
  current: {
    temp: number;
    feels_like: number;
    description: string;
    icon: string;
    humidity: number;
    wind_speed: number;
  };
  // 🆕 4 jours de prévisions (aujourd'hui + 3)
  forecast: Array<{
    date: string;
    label: string;
    dayOfWeek: string;
    dayOfMonth: number;
    month: string;
    min: number;
    max: number;
    morning: { temp: number; description: string };
    afternoon: { temp: number; description: string };
    evening: { temp: number; description: string };
  }>;
  advice: string;
}

/**
 * Récupère la météo pour une ville (avec cache 1h).
 *
 * @param db — base SQLite
 * @param userId — identifiant utilisateur (pour le cache)
 * @param city — nom de la ville
 * @param bypassCache — true pour forcer le rechargement (utile pour une autre ville)
 */
export async function fetchWeather(
  db: SQLite.SQLiteDatabase,
  userId: string,
  city: string,
  bypassCache: boolean = false
): Promise<WeatherData | null> {
  try {
    // 1. Vérifier le cache (si même ville + moins de 1h)
    if (!bypassCache) {
      const cached = await getCachedWeather(db, userId);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as WeatherData;
          // Vérifier que c'est la même ville
          if (parsed.city.toLowerCase() === city.toLowerCase()) {
            return parsed;
          }
        } catch (e) {
          // Cache corrompu, on ignore
        }
      }
    }

    // 2. Appeler le serveur
    const response = await fetch(
      `${API_BASE_URL}/weather?city=${encodeURIComponent(city)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('[Prof] Erreur météo serveur:', response.status, errorText);
      return null;
    }

    const data: WeatherData = await response.json();

    // 3. Mettre en cache
    try {
      await cacheWeather(db, userId, JSON.stringify(data));
    } catch (e) {
      console.warn('[Prof] Impossible de mettre la météo en cache:', e);
    }

    return data;
  } catch (e) {
    console.warn('[Prof] Erreur fetchWeather:', e);
    return null;
  }
}

/**
 * Formate les données météo (3 jours) pour injection dans le prompt de Prof.
 */
export function formatWeatherForPrompt(data: WeatherData): string {
  const lines: string[] = [
    '## DONNÉES MÉTÉO (3 JOURS)',
    '',
    `Ville : ${data.city}`,
    '',
    `**Maintenant** : ${data.current.temp}°C (ressenti ${data.current.feels_like}°C), ${data.current.description}`,
    '',
    '**PRÉVISIONS :**',
  ];

  // Afficher chaque jour disponible
  for (const day of data.forecast) {
    const dateLabel = `${day.label} (${day.dayOfWeek} ${day.dayOfMonth} ${day.month})`;
    lines.push('');
    lines.push(`### ${dateLabel}`);
    lines.push(`- Matin : ${day.morning.temp}°C, ${day.morning.description}`);
    lines.push(`- Après-midi : ${day.afternoon.temp}°C, ${day.afternoon.description}`);
    lines.push(`- Soir : ${day.evening.temp}°C, ${day.evening.description}`);
    lines.push(`- Min/Max : ${day.min}°C / ${day.max}°C`);
  }

  lines.push('');
  lines.push(`**Vent** : ${data.current.wind_speed} km/h`);
  lines.push(`**Humidité** : ${data.current.humidity}%`);
  lines.push('');
  lines.push(`💡 **Conseil à donner** : ${data.advice}`);
  lines.push('');
  lines.push('IMPORTANT : tu as accès aux prévisions sur 3 JOURS (aujourd\'hui, demain, après-demain).');
  lines.push('Si l\'enfant demande la météo de demain ou d\'un autre jour, utilise ces données.');
  lines.push('Donne un résumé détaillé et chaleureux (3-5 phrases fluides), PAS de liste brute.');

  return lines.join('\n');
}

/**
 * 🆕 Détecte si un message demande la météo.
 */
export function isWeatherQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = [
    'météo',
    'meteo',
    'temps',
    'quel temps',
    'il fait quel',
    'température',
    'temperature',
    'il pleut',
    'il fait beau',
    'il fait froid',
    'il fait chaud',
    'pleut-il',
    'pleut il',
    'va-t-il pleuvoir',
    'va t il pleuvoir',
  ];
  return keywords.some((k) => lower.includes(k));
}

/**
 * 🆕 Détecte si un message demande la météo d'une AUTRE ville.
 * Ex: "Quel temps à Marseille ?", "Il fait beau à Paris ?"
 */
export function extractCityFromMessage(text: string): string | null {
  // Patterns courants
  const patterns = [
    /(?:à|a|vers|sur|pour)\s+([A-Z][a-zA-ZÀ-ÿ-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ-]+)*)/,
    /(?:ville de|à|a)\s+([A-Z][a-zA-ZÀ-ÿ-]+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * 🆕 Détecte si l'utilisateur déclare déménager/être dans une ville.
 * Ex: "je suis à Lyon", "j'habite à Nice", "je suis en vacances à Marseille"
 */
export function extractCityChangeFromMessage(text: string): string | null {
  const lower = text.toLowerCase();
  const triggers = [
    'je suis à',
    'je suis a',
    'j\'habite à',
    'j\'habite a',
    'jhabite à',
    'jhabite a',
    'j\'habite',
    'jhabite',
    'déménage à',
    'demenage a',
    'je vis à',
    'je vis a',
    'je suis en vacances à',
    'en vacances à',
    'je pars à',
  ];

  for (const trigger of triggers) {
    const idx = lower.indexOf(trigger);
    if (idx !== -1) {
      // Extraire ce qui suit
      const after = text.slice(idx + trigger.length).trim();
      const match = after.match(/^([A-Z][a-zA-ZÀ-ÿ-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ-]+)*)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }

  return null;
}