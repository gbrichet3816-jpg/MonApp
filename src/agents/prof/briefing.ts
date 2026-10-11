// src/agents/prof/briefing.ts
// Construction des données de briefing (matin + soir) pour l'Agent Prof

import * as SQLite from 'expo-sqlite';
import {
    getEventsAwaitingGrade,
    getEventsForDate,
    getFragileTopics,
    getProfProfile,
    getSchedule,
    type ProfEvent
} from './database';
import { fetchWeather } from './weather';

// ============================================================
// CONSTANTES
// ============================================================

export const MORNING_BRIEFING_PROMPT = `Tu es "Prof". Tu composes ton BRIEFING DU MATIN pour l'enfant.
Tu viens de recevoir les données du jour : météo actuelle + emploi du temps.

Compose UN SEUL message court (3-5 lignes max), chaleureux et utile.

## Structure attendue
1. Salutation chaleureuse (Bonjour !)
2. Météo du jour avec UN conseil concret (pull, parapluie…)
3. Rappel de prendre son sac 🎒
4. Heure du premier cours (si emploi du temps mémorisé)
5. Une phrase d'encouragement courte

## Exemple
« Bonjour ! 👋 Aujourd'hui il fait 12°C à Vif, ciel nuageux — prends un pull.
Pense à prendre ton sac 🎒 Ton premier cours est à 8h30 (Maths). Bonne journée ! »

## Règles
- Ne liste PAS tous les cours, juste le PREMIER.
- Pas de chiffres bruts (humidité, pression).
- Un seul conseil météo.
- Termine par un encouragement court (pas de superlatif excessif).`;

export const EVENING_BRIEFING_PROMPT = `Tu es "Prof". Tu composes ton BRIEFING DU SOIR pour l'enfant.
Tu viens de recevoir les données sur la journée de demain et éventuellement
des contrôles passés en attente de note.

Compose UN SEUL message court (3-5 lignes max), chaleureux et utile.

## Structure attendue
1. Salutation (Bonsoir !)
2. Rappel de préparer son sac pour demain 🎒
3. Liste des cours du lendemain (si emploi du temps mémorisé)
4. Optionnel : événement important (contrôle demain, notion fragile)
5. Optionnel : question courte sur une note en attente

## Exemple
« Bonsoir ! 🌙 Pense à préparer ton sac pour demain.
Tu as : Français à 8h30, Maths à 10h30, Histoire à 14h. Bonne soirée ! »

## Règles
- Tu listes les cours du lendemain, avec heure et matière.
- Tu choisis les infos les PLUS importantes (contrôle demain = priorité).
- Si note en attente → demande-la gentiment.
- Pas de chiffres bruts, ton chaleureux.`;

// ============================================================
// BRIEFING DU MATIN
// ============================================================

export interface MorningBriefingData {
  hasData: boolean;
  promptData: string;
}

/**
 * Construit les données du briefing du matin.
 * Renvoie `hasData: false` si rien à dire (pas d'EDT, pas de météo).
 */
export async function buildMorningBriefingData(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<MorningBriefingData> {
  const profile = await getProfProfile(db, userId);

  // Récupérer les cours d'aujourd'hui
  const today = new Date();
  const jsDay = today.getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
  const schedule = await getSchedule(db, userId, dayOfWeek);

  // Récupérer la météo (si ville enregistrée)
  let weatherBlock = '';
  if (profile?.weather_city && profile.weather_enabled === 1) {
    try {
      const weather = await fetchWeather(db, userId, profile.weather_city);
      if (weather) {
        const temp = weather.current.temp;
        const desc = weather.current.description;
        const advice =
          temp < 5 ? 'Il fait froid, mets un bon manteau 🧥' :
          temp < 12 ? 'Un pull sera utile 🧥' :
          temp > 28 ? 'Il fait chaud, pense à boire de l\'eau 💧' :
          temp > 25 ? 'Pense à boire de l\'eau 💧' :
          desc.toLowerCase().includes('pluie') ? 'Prends un parapluie ☔' :
          desc.toLowerCase().includes('nuage') ? 'Le ciel est nuageux aujourd\'hui' :
          'Bonne journée pour sortir 😊';

        weatherBlock = `**Météo** : ${temp}°C, ${desc} à ${profile.weather_city}.\n**Conseil** : ${advice}`;
      }
    } catch (e) {
      console.warn('[Briefing Matin] Erreur météo:', e);
    }
  }

  // Si rien du tout → pas de briefing utile
  if (schedule.length === 0 && !weatherBlock) {
    return { hasData: false, promptData: '' };
  }

  const lines: string[] = ['## DONNÉES DU BRIEFING DU MATIN', ''];

  if (profile?.child_name && profile.child_name !== 'Enfant') {
    lines.push(`Enfant : ${profile.child_name}`);
    lines.push('');
  }

  if (weatherBlock) {
    lines.push('### Météo');
    lines.push(weatherBlock);
    lines.push('');
  }

  if (schedule.length > 0) {
    const sorted = [...schedule].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const firstCourse = sorted[0];

    lines.push('### Emploi du temps du jour');
    for (const item of sorted) {
      lines.push(`- ${item.start_time} - ${item.end_time} : ${item.subject}`);
    }
    lines.push('');
    lines.push(`👉 **Premier cours** : ${firstCourse.subject} à ${firstCourse.start_time}`);
    lines.push('');
  } else {
    lines.push('### Emploi du temps');
    lines.push('Pas de cours enregistrés pour aujourd\'hui.');
    lines.push('');
  }

  lines.push('## TON MESSAGE');
  lines.push('');
  lines.push('Compose UN message court (3-5 lignes) qui :');
  lines.push('- Salue chaleureusement');
  lines.push('- Donne la météo + un conseil');
  lines.push('- Rappelle de prendre son sac 🎒');
  if (schedule.length > 0) {
    lines.push('- Mentionne l\'heure du PREMIER cours');
  }
  lines.push('- Termine par un encouragement court');

  return {
    hasData: true,
    promptData: lines.join('\n'),
  };
}

// ============================================================
// BRIEFING DU SOIR
// ============================================================

export interface EveningBriefingData {
  hasData: boolean;
  promptData: string;
  pendingGrades: ProfEvent[];
}

/**
 * Construit les données du briefing du soir.
 * Renvoie `hasData: false` si rien à dire.
 */
export async function buildEveningBriefingData(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<EveningBriefingData> {
  const profile = await getProfProfile(db, userId);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const jsDay = tomorrow.getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

  const tomorrowEvents = await getEventsForDate(db, userId, tomorrow);
  const tomorrowSchedule = await getSchedule(db, userId, dayOfWeek);
  const fragileTopics = await getFragileTopics(db, userId);
  const pendingGrades = await getEventsAwaitingGrade(db, userId);

  // Si rien du tout → pas de briefing
  if (
    tomorrowEvents.length === 0 &&
    fragileTopics.length === 0 &&
    tomorrowSchedule.length === 0 &&
    pendingGrades.length === 0
  ) {
    return { hasData: false, promptData: '', pendingGrades: [] };
  }

  const lines: string[] = ['## DONNÉES DU BRIEFING DU SOIR', ''];

  if (profile?.child_name && profile.child_name !== 'Enfant') {
    lines.push(`Enfant : ${profile.child_name}`);
    lines.push('');
  }

  if (tomorrowEvents.length > 0) {
    lines.push('### 📅 Événements demain');
    for (const ev of tomorrowEvents) {
      const typeLabel =
        ev.type === 'controle' ? 'Contrôle' :
        ev.type === 'devoir' ? 'Devoir' :
        'Leçon';
      lines.push(`- ${typeLabel} de ${ev.subject} : ${ev.title}`);
    }
    lines.push('');
  }

  if (tomorrowSchedule.length > 0) {
    lines.push('### 📚 Cours demain');
    const sorted = [...tomorrowSchedule].sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (const item of sorted) {
      lines.push(`- ${item.start_time} : ${item.subject}`);
    }
    lines.push('');
  }

  if (fragileTopics.length > 0) {
    lines.push('### ⚠️ Notions fragiles');
    for (const t of fragileTopics) {
      lines.push(`- ${t.subject} : ${t.topic}`);
    }
    lines.push('');
  }

  if (pendingGrades.length > 0) {
    lines.push('### 📝 Contrôles en attente de note');
    for (const ev of pendingGrades) {
      const daysAgo = Math.floor((Date.now() - ev.due_date) / (24 * 60 * 60 * 1000));
      lines.push(`- [ID: ${ev.id}] ${ev.subject} : ${ev.title} (il y a ${daysAgo} jours)`);
    }
    lines.push('');
    lines.push('👉 Glisse une question COURTE pour demander la note (ex: "Au fait, tu as eu ta note de Maths ?")');
    lines.push('');
  }

  lines.push('## TON MESSAGE');
  lines.push('');
  lines.push('Compose UN message court (3-5 lignes) qui :');
  lines.push('- Salue (Bonsoir !)');
  lines.push('- Rappelle de faire son sac pour demain 🎒');
  lines.push('- Liste les cours du lendemain (heure + matière)');
  lines.push('- Si contrôle demain → priorité absolue');
  lines.push('- Si note en attente → demande-la gentiment');
  lines.push('- Ton chaleureux, pas de superlatif excessif');

  return {
    hasData: true,
    promptData: lines.join('\n'),
    pendingGrades,
  };
}