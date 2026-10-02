// src/agents/prof/onboarding.ts
// Logique d'onboarding de l'Agent Prof : détection 1er lancement + questions

import * as SQLite from 'expo-sqlite';
import {
  PROF_ONBOARDING_PROMPT,
  deduceLevel,
  levelLabel,
  type ProfLevelKey,
} from './config';
import {
  createProfProfile,
  disableWeather,
  getProfProfile,
  incrementWeatherRefusal,
  setWeatherCity,
  type ProfProfile,
} from './database';

/**
 * Étapes de l'onboarding.
 */
export type OnboardingStep =
  | 'need_name'
  | 'need_age'
  | 'need_grade'
  | 'need_city'
  | 'done';

/**
 * État temporaire de l'onboarding.
 */
export interface OnboardingState {
  step: OnboardingStep;
  child_name?: string;
  child_age?: number;
  child_grade?: string;
  child_level?: ProfLevelKey;
  weather_city?: string;
  city_refused?: boolean;
}

/**
 * Résultat de la détection.
 */
export interface OnboardingCheck {
  needsOnboarding: boolean;
  profile: ProfProfile | null;
}

/**
 * Vérifie si l'utilisateur a déjà un profil enfant.
 */
export async function checkOnboarding(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<OnboardingCheck> {
  const profile = await getProfProfile(db, userId);
  return {
    needsOnboarding: profile === null || profile.onboarded === 0,
    profile,
  };
}

/**
 * Message d'accueil.
 */
export const ONBOARDING_GREETING = `👋 Bonjour ! Je suis Prof, ton professeur particulier.

Avant qu'on commence, j'ai besoin de connaître ton enfant.
Comment s'appelle-t-il / elle ?`;

/**
 * État initial.
 */
export function createInitialState(): OnboardingState {
  return { step: 'need_name' };
}

/**
 * Détecte si l'utilisateur refuse de donner sa ville.
 */
function isCityRefusal(input: string): boolean {
  const lower = input.toLowerCase().trim();
  const refusalKeywords = [
    'non',
    'pas',
    'aucune',
    'plus tard',
    'je sais pas',
    'sais pas',
    'sais-pas',
    'skip',
    'passer',
    'pass',
    'rien',
    'aucun',
    'sans',
  ];
  return refusalKeywords.some((k) => lower.includes(k));
}

/**
 * Analyse la réponse de l'utilisateur selon l'étape en cours.
 */
export function processOnboardingAnswer(
  state: OnboardingState,
  userInput: string
): { nextState: OnboardingState; nextQuestion: string | null; error?: string } {
  const input = userInput.trim();
  if (!input) {
    return {
      nextState: state,
      nextQuestion: null,
      error: "Je n'ai rien reçu. Tu peux répéter ? 😊",
    };
  }

  switch (state.step) {
    case 'need_name': {
      if (/^\d+$/.test(input)) {
        return {
          nextState: state,
          nextQuestion: null,
          error: "Ça ressemble à un nombre 😅 Tu peux me donner le prénom ?",
        };
      }
      return {
        nextState: {
          ...state,
          child_name: input,
          step: 'need_age',
        },
        nextQuestion: `Enchanté ${input} ! 😊 Quel âge a-t-il / elle ?`,
      };
    }

    case 'need_age': {
      const ageMatch = input.match(/\d+/);
      if (!ageMatch) {
        return {
          nextState: state,
          nextQuestion: null,
          error: "Je n'ai pas compris l'âge. Tu peux me donner un nombre ?",
        };
      }
      const age = parseInt(ageMatch[0], 10);
      if (age < 3 || age > 25) {
        return {
          nextState: state,
          nextQuestion: null,
          error: "L'âge doit être compris entre 3 et 25 ans. Tu peux préciser ?",
        };
      }
      return {
        nextState: {
          ...state,
          child_age: age,
          step: 'need_grade',
        },
        nextQuestion: `Super ! En quelle classe est ${state.child_name} ? (CP, CE1, CM2, 6e, 5e, 3e, 2nde, 1ère, Terminale…)`,
      };
    }

    case 'need_grade': {
      const level = deduceLevel(input);
      if (!level) {
        return {
          nextState: state,
          nextQuestion: null,
          error:
            "Je n'ai pas reconnu cette classe. Tu peux me la redonner ? (ex: CM2, 5e, 2nde…)",
        };
      }
      return {
        nextState: {
          ...state,
          child_grade: input,
          child_level: level,
          step: 'need_city',
        },
        nextQuestion:
          `Parfait ! Donc je suis le prof de ${state.child_name}, ${state.child_age} ans, en ${input} (${levelLabel(level)}).\n\n` +
          `Et pour finir, dans quelle ville habitez-vous ?\n` +
          `(Comme ça, je pourrai te donner la météo du matin 🙂)`,
      };
    }

    case 'need_city': {
      // Détection de refus
      if (isCityRefusal(input)) {
        return {
          nextState: {
            ...state,
            city_refused: true,
            step: 'done',
          },
          nextQuestion:
            `Pas de souci ! Tu pourras me le dire plus tard si tu veux 😊\n\n` +
            `Voilà, tout est prêt ! On peut commencer quand tu veux.`,
        };
      }

      // L'utilisateur a donné une ville
      const city = input.charAt(0).toUpperCase() + input.slice(1);
      return {
        nextState: {
          ...state,
          weather_city: city,
          step: 'done',
        },
        nextQuestion:
          `Super ! J'ai bien noté : ${city} 📍\n\n` +
          `Voilà, tout est prêt ! On peut commencer quand tu veux.`,
      };
    }

    case 'done':
      return { nextState: state, nextQuestion: null };
  }
}

/**
 * Finalise l'onboarding : crée le profil + enregistre la ville si donnée.
 */
export async function finalizeOnboarding(
  db: SQLite.SQLiteDatabase,
  userId: string,
  state: OnboardingState
): Promise<ProfProfile | null> {
  if (
    state.step !== 'done' ||
    !state.child_name ||
    !state.child_age ||
    !state.child_grade ||
    !state.child_level
  ) {
    return null;
  }

  // 1. Créer le profil (sans ville pour l'instant)
  await createProfProfile(
    db,
    userId,
    state.child_name,
    state.child_age,
    state.child_grade,
    state.child_level
  );

  // 2. Si une ville a été donnée → on l'enregistre
  if (state.weather_city) {
    await setWeatherCity(db, userId, state.weather_city);
  } else if (state.city_refused) {
    // L'utilisateur a refusé → on incrémente le compteur
    // (mais on n'ira pas jusqu'à 3 ici car c'est la 1ère demande)
    await incrementWeatherRefusal(db, userId);
  }

  return await getProfProfile(db, userId);
}

/**
 * Utilitaire : formulaire manuel (fallback).
 */
export async function createProfileFromForm(
  db: SQLite.SQLiteDatabase,
  userId: string,
  childName: string,
  childAge: number,
  childGrade: string,
  weatherCity?: string
): Promise<ProfProfile | null> {
  const level = deduceLevel(childGrade);
  if (!level) return null;

  await createProfProfile(db, userId, childName, childAge, childGrade, level);

  if (weatherCity && weatherCity.trim().length > 0) {
    const city = weatherCity.trim().charAt(0).toUpperCase() + weatherCity.trim().slice(1);
    await setWeatherCity(db, userId, city);
  }

  return await getProfProfile(db, userId);
}

/**
 * 🆕 Vérifie si on doit redemander la ville à l'ouverture de Prof.
 * Conditions :
 * - L'utilisateur a un profil
 * - Pas de ville enregistrée
 * - La météo est activée (pas encore 3 refus)
 * - On n'a pas déjà demandé aujourd'hui
 */
export async function shouldAskWeatherCity(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<boolean> {
  const profile = await getProfProfile(db, userId);
  if (!profile) return false;
  if (profile.weather_city) return false; // a déjà une ville
  if (profile.weather_enabled === 0) return false; // désactivé après 3 refus

  // Vérifier le dernier prompt
  const state = await db.getFirstAsync<{ last_weather_refusal_prompt_at: number | null }>(
    `SELECT last_weather_refusal_prompt_at FROM prof_state WHERE user_id = ?`,
    [userId]
  );

  if (!state || !state.last_weather_refusal_prompt_at) return true;

  // Vérifier qu'on n'a pas déjà demandé aujourd'hui
  const lastDate = new Date(state.last_weather_refusal_prompt_at);
  const today = new Date();
  const sameDay =
    lastDate.getDate() === today.getDate() &&
    lastDate.getMonth() === today.getMonth() &&
    lastDate.getFullYear() === today.getFullYear();

  return !sameDay;
}

/**
 * 🆕 Gère un refus de ville (redemande).
 * Incrémente le compteur. Si >= 3 → désactive la météo.
 */
export async function handleCityRefusal(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<{ refusals: number; disabled: boolean }> {
  const refusals = await incrementWeatherRefusal(db, userId);

  if (refusals >= 3) {
    await disableWeather(db, userId);
    return { refusals, disabled: true };
  }

  return { refusals, disabled: false };
}

/**
 * Export du prompt système onboarding.
 */
export { PROF_ONBOARDING_PROMPT };
