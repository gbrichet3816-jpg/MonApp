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
    getProfProfile,
    type ProfProfile,
} from './database';

/**
 * Étapes de l'onboarding.
 */
export type OnboardingStep =
  | 'need_name'
  | 'need_age'
  | 'need_grade'
  | 'done';

/**
 * État temporaire de l'onboarding, gardé en mémoire
 * tant que l'utilisateur n'a pas fini de répondre.
 */
export interface OnboardingState {
  step: OnboardingStep;
  child_name?: string;
  child_age?: number;
  child_grade?: string;
  child_level?: ProfLevelKey;
}

/**
 * Résultat de la détection : a-t-on besoin de lancer l'onboarding ?
 */
export interface OnboardingCheck {
  needsOnboarding: boolean;
  profile: ProfProfile | null;
}

/**
 * Vérifie si l'utilisateur a déjà un profil enfant.
 * - Si oui → pas d'onboarding
 * - Si non → onboarding à lancer
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
 * Message d'accueil à afficher quand l'onboarding démarre.
 * (Basé sur PROF_ONBOARDING_PROMPT, mais on met le texte en dur
 * pour ne pas dépendre d'un appel API juste pour un message fixe.)
 */
export const ONBOARDING_GREETING = `👋 Bonjour ! Je suis Prof, ton professeur particulier.

Avant qu'on commence, j'ai besoin de connaître ton enfant.
Comment s'appelle-t-il / elle ?`;

/**
 * État initial de l'onboarding.
 */
export function createInitialState(): OnboardingState {
  return { step: 'need_name' };
}

/**
 * Analyse la réponse de l'utilisateur selon l'étape en cours
 * et met à jour l'état. Retourne la question suivante ou null si terminé.
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
      // On accepte tout sauf les chiffres seuls
      if (/^\d+$/.test(input)) {
        return {
          nextState: state,
          nextQuestion: null,
          error: "Ça ressemble à un nombre 😅 Tu peux me donner le prénom ?",
        };
      }
      const nextState: OnboardingState = {
        ...state,
        child_name: input,
        step: 'need_age',
      };
      return {
        nextState,
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
      const nextState: OnboardingState = {
        ...state,
        child_age: age,
        step: 'need_grade',
      };
      return {
        nextState,
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
      const nextState: OnboardingState = {
        ...state,
        child_grade: input,
        child_level: level,
        step: 'done',
      };
      return {
        nextState,
        nextQuestion: `Parfait ! Donc je suis le prof de ${state.child_name}, ${state.child_age} ans, en ${input} (${levelLabel(level)}). On va bien s'entendre 😊`,
      };
    }

    case 'done':
      return { nextState: state, nextQuestion: null };
  }
}

/**
 * Finalise l'onboarding : crée le profil en base et retourne le profil créé.
 * À appeler une fois que `state.step === 'done'`.
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

  await createProfProfile(
    db,
    userId,
    state.child_name,
    state.child_age,
    state.child_grade,
    state.child_level
  );

  return await getProfProfile(db, userId);
}

/**
 * Fonction utilitaire pour les cas où le parent remplit le formulaire manuel
 * (onboarding option C : conversation + formulaire de secours).
 */
export async function createProfileFromForm(
  db: SQLite.SQLiteDatabase,
  userId: string,
  childName: string,
  childAge: number,
  childGrade: string
): Promise<ProfProfile | null> {
  const level = deduceLevel(childGrade);
  if (!level) return null;

  await createProfProfile(db, userId, childName, childAge, childGrade, level);
  return await getProfProfile(db, userId);
}

/**
 * Export du prompt système onboarding (au cas où l'agent aurait besoin
 * de continuer la conversation naturellement après les 3 questions).
 */
export { PROF_ONBOARDING_PROMPT };
