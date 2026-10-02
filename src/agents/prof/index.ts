// src/agents/prof/index.ts
// Point d'entrée de l'Agent Prof : orchestration complète

import * as SQLite from 'expo-sqlite';
import {
    buildSystemPrompt,
    PROF_ONBOARDING_PROMPT,
    selectModel,
} from './config';
import {
    getProfMessages,
    getProfProfile,
    openProfDatabase,
    saveProfMessage,
    type ProfMessage,
    type ProfProfile,
} from './database';
import {
    checkOnboarding,
    createInitialState,
    finalizeOnboarding,
    ONBOARDING_GREETING,
    processOnboardingAnswer,
    type OnboardingState,
} from './onboarding';

// ============================================================
// TYPE : MESSAGE AFFICHÉ DANS L'UI
// ============================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}

// ============================================================
// APPEL API DEEPSEEK (via le serveur Railway)
// ============================================================

/**
 * URL du serveur Railway qui expose DeepSeek.
 */
const API_BASE_URL = 'https://monapp-server-production.up.railway.app';

/**
 * Appelle l'API DeepSeek via le serveur Railway.
 * Le serveur garde la clé DeepSeek secrète.
 */
async function callDeepSeek(
  messages: { role: string; content: string }[],
  model: string
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur API DeepSeek (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.content ?? data.message?.content ?? '';
}

// ============================================================
// INITIALISATION DE L'AGENT
// ============================================================

let profDb: SQLite.SQLiteDatabase | null = null;

/**
 * Initialise l'agent Prof : ouvre la base.
 */
export async function initProfAgent(): Promise<SQLite.SQLiteDatabase> {
  if (profDb) return profDb;
  profDb = await openProfDatabase();
  return profDb;
}

// ============================================================
// DÉMARRAGE DE LA CONVERSATION
// ============================================================

export interface StartResult {
  needsOnboarding: boolean;
  messages: ChatMessage[];
  onboardingState?: OnboardingState;
}

/**
 * Démarre la conversation pour un utilisateur donné.
 * - Si pas de profil → lance l'onboarding
 * - Si profil existe → charge l'historique
 */
export async function startProfConversation(
  userId: string
): Promise<StartResult> {
  const db = await initProfAgent();

  const { needsOnboarding } = await checkOnboarding(db, userId);

  if (needsOnboarding) {
    const greeting: ChatMessage = {
      id: `greet-${Date.now()}`,
      role: 'assistant',
      content: ONBOARDING_GREETING,
      created_at: Date.now(),
    };
    return {
      needsOnboarding: true,
      messages: [greeting],
      onboardingState: createInitialState(),
    };
  }

  const history = await getProfMessages(db, userId, 50);
  const messages: ChatMessage[] = history.map((m) => ({
    id: String(m.id ?? Date.now()),
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
    created_at: m.created_at,
  }));

  return { needsOnboarding: false, messages };
}

// ============================================================
// ENVOI D'UN MESSAGE
// ============================================================

export interface SendResult {
  messages: ChatMessage[];
  onboardingState?: OnboardingState;
  onboardingDone?: boolean;
}

/**
 * Envoie un message utilisateur et retourne la réponse de l'agent.
 */
export async function sendProfMessage(
  userId: string,
  userText: string,
  onboardingState?: OnboardingState
): Promise<SendResult> {
  const db = await initProfAgent();
  const now = Date.now();

  const userMsg: ChatMessage = {
    id: `u-${now}`,
    role: 'user',
    content: userText,
    created_at: now,
  };

  // ---- MODE ONBOARDING ----
  if (onboardingState && onboardingState.step !== 'done') {
    const { nextState, nextQuestion, error } = processOnboardingAnswer(
      onboardingState,
      userText
    );

    if (error) {
      const botMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: error,
        created_at: Date.now(),
      };
      return {
        messages: [userMsg, botMsg],
        onboardingState,
      };
    }

    if (nextQuestion) {
      const botMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: nextQuestion,
        created_at: Date.now(),
      };

      if (nextState.step === 'done') {
        await finalizeOnboarding(db, userId, nextState);
        return {
          messages: [userMsg, botMsg],
          onboardingState: nextState,
          onboardingDone: true,
        };
      }

      return {
        messages: [userMsg, botMsg],
        onboardingState: nextState,
      };
    }
  }

  // ---- MODE CHAT NORMAL ----
  const profile = await getProfProfile(db, userId);
  if (!profile) {
    throw new Error(
      "Profil enfant introuvable. L'onboarding n'a pas été finalisé."
    );
  }

  await saveProfMessage(db, userId, 'user', userText);

  const history = await getProfMessages(db, userId, 30);

  const systemPrompt = buildSystemPrompt({
    child_name: profile.child_name,
    child_age: profile.child_age,
    child_grade: profile.child_grade,
    child_level: profile.child_level,
  });

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const model = selectModel(userText);

  let botText: string;
  try {
    botText = await callDeepSeek(apiMessages, model);
  } catch (err: any) {
    botText =
      "Oups, je n'arrive pas à réfléchir là tout de suite 😅 Tu peux réessayer dans un instant ?";
    console.error('[Prof] Erreur DeepSeek:', err);
  }

  await saveProfMessage(db, userId, 'assistant', botText);

  const botMsg: ChatMessage = {
    id: `a-${Date.now()}`,
    role: 'assistant',
    content: botText,
    created_at: Date.now(),
  };

  return { messages: [userMsg, botMsg] };
}

// ============================================================
// RÉCUPÉRATION DU PROFIL
// ============================================================

export async function getProfProfileFor(
  userId: string
): Promise<ProfProfile | null> {
  const db = await initProfAgent();
  return await getProfProfile(db, userId);
}

// ============================================================
// EXPORTS
// ============================================================

export { PROF_ONBOARDING_PROMPT };
export type { OnboardingState, ProfMessage, ProfProfile };
