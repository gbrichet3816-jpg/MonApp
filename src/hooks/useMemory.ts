// src/hooks/useMemory.ts
// 🧠 Hook React pour la mémoire longue de Prof
// Orchestre la génération des résumés + l'extraction des comportements

import { useCallback, useRef, useState } from 'react';

import {
    buildMemoryContext,
    getLearnedPatterns,
    getMessagesToSummarize,
    getRecentSummaries,
    openProfDatabase,
    saveLearnedPattern,
    saveSummary,
    shouldGenerateSummary,
} from '@/agents/prof/database';
import { sendMessageToAgent } from '@/config/api';

// ============================================================
// CONFIGURATION
// ============================================================

/** Nombre de messages à traiter par cycle d'extraction de comportements */
const MESSAGES_BETWEEN_PATTERN_EXTRACTION = 15;

/** Nombre maximum de caractères d'un résumé (limite de sécurité) */
const MAX_SUMMARY_LENGTH = 800;

// ============================================================
// TYPES
// ============================================================

export interface MemoryContext {
  context: string;             // Le bloc à injecter dans le prompt
  summaries: number;           // Nombre de résumés chargés
  patterns: number;            // Nombre de patterns chargés
  topics: number;              // Nombre de notions à revoir
}

export interface UseMemoryReturn {
  /** Charge le contexte mémoire à injecter dans le prompt */
  loadContext: (userId: string) => Promise<MemoryContext>;

  /** Vérifie si un résumé doit être généré et le génère si nécessaire (async, non bloquant) */
  maybeGenerateSummary: (userId: string) => Promise<void>;

  /** Extrait les comportements appris de l'enfant (async, non bloquant) */
  maybeExtractPatterns: (userId: string) => Promise<void>;

  /** Reset le compteur interne (utile pour tests) */
  reset: () => void;
}

// ============================================================
// HOOK
// ============================================================

export function useMemory(): UseMemoryReturn {
  const lastPatternExtractionRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const [lastSummaryId, setLastSummaryId] = useState<number | null>(null);

  // ============================================================
  // CHARGEMENT DU CONTEXTE MÉMOIRE
  // ============================================================

  const loadContext = useCallback(async (userId: string): Promise<MemoryContext> => {
    try {
      const db = await openProfDatabase();
      const context = await buildMemoryContext(db, userId);

      // Compter les éléments pour les logs
      const summaries = await getRecentSummaries(db, userId, 3);
      const patterns = await getLearnedPatterns(db, userId, 5);

      // Compter les notions à revoir
      const topicsToReview = db.getFirstSync<{ count: number }>(
  `SELECT COUNT(*) as count FROM prof_topics WHERE user_id = ? AND next_review_at <= ? AND status != 'acquired'`,
  [userId, Date.now()]
)?.count ?? 0;

      console.log(`🧠 [Mémoire] Contexte chargé: ${summaries.length} résumés, ${patterns.length} patterns, ${topicsToReview} notions à revoir`);

      return {
        context,
        summaries: summaries.length,
        patterns: patterns.length,
        topics: topicsToReview,
      };
    } catch (e) {
      console.warn('[Mémoire] Erreur loadContext:', e);
      return { context: '', summaries: 0, patterns: 0, topics: 0 };
    }
  }, []);

  // ============================================================
  // GÉNÉRATION DE RÉSUMÉ
  // ============================================================

  const maybeGenerateSummary = useCallback(async (userId: string): Promise<void> => {
    if (isProcessingRef.current) {
      console.log('🧠 [Mémoire] Génération déjà en cours, skip');
      return;
    }

    try {
      const db = await openProfDatabase();

      // 1. Vérifier si un résumé doit être généré
      const should = await shouldGenerateSummary(db, userId);
      if (!should) return;

      console.log('🧠 [Mémoire] Génération du résumé déclenchée');

      // 2. Récupérer les messages à résumer
      const messages = await getMessagesToSummarize(db, userId);
      if (messages.length === 0) {
        console.log('🧠 [Mémoire] Aucun message à résumer');
        return;
      }

      // 3. Construire le prompt de résumé
      const conversationText = messages
        .map((m) => `${m.role === 'user' ? 'Enfant' : 'Prof'} : ${m.content}`)
        .join('\n');

      const summaryPrompt = `Tu es un assistant qui résume des conversations éducatives
entre un professeur particulier (Prof) et un enfant.

# CONVERSATION À RÉSUMER
${conversationText}

# TA MISSION
Résume cette conversation en 100-150 mots MAXIMUM. Le résumé doit contenir :
1. Les notions travaillées (matière + sujet précis)
2. Les difficultés rencontrées par l'enfant (si identifiées)
3. Les réussites / progrès observés
4. Le contexte général (humeur, motivation, sujets annexes)

# FORMAT
- Pas de titres, pas de listes
- Un paragraphe fluide en français
- Ton neutre, factuel
- Pas d'inventions : uniquement ce qui est dans la conversation

# EXEMPLE
"L'enfant a travaillé les fractions (comparaison, addition avec même dénominateur).
Il a bien compris le principe mais confond encore numérateur et dénominateur.
Motivation correcte, il a posé plusieurs questions. Une blague sur les pizzas a
détendu l'atmosphère. Il a aussi parlé de son match de foot de samedi."

Réponds uniquement avec le résumé, sans introduction ni conclusion.`;

      // 4. Appeler DeepSeek pour résumer
      const periodStart = messages[0].created_at;
      const periodEnd = messages[messages.length - 1].created_at;

      isProcessingRef.current = true;

      const result = await sendMessageToAgent({
        messages: [{ role: 'user', content: summaryPrompt }],
        agentSystemPrompt: 'Tu résumes des conversations éducatives.',
        enableTools: false,
        agentId: 'prof',
      });

      if (!result.reply || result.reply.trim().length === 0) {
        console.warn('🧠 [Mémoire] Résumé vide, skip');
        isProcessingRef.current = false;
        return;
      }

      // 5. Tronquer le résumé si trop long
      let summary = result.reply.trim();
      if (summary.length > MAX_SUMMARY_LENGTH) {
        summary = summary.substring(0, MAX_SUMMARY_LENGTH) + '...';
      }

      // 6. Sauvegarder le résumé
      await saveSummary(db, userId, summary, messages.length, periodStart, periodEnd);
      console.log(`🧠 [Mémoire] Résumé sauvegardé (${summary.length} caractères, ${messages.length} messages)`);

      isProcessingRef.current = false;
    } catch (e) {
      console.warn('🧠 [Mémoire] Erreur maybeGenerateSummary:', e);
      isProcessingRef.current = false;
    }
  }, []);

  // ============================================================
  // EXTRACTION DES COMPORTEMENTS APPRIS
  // ============================================================

  const maybeExtractPatterns = useCallback(async (userId: string): Promise<void> => {
    if (isProcessingRef.current) return;

    try {
      const db = await openProfDatabase();

      // 1. Compter les messages depuis la dernière extraction
      const lastExtraction = lastPatternExtractionRef.current;
      const countRow = db.getFirstSync<{ count: number }>(
        `SELECT COUNT(*) as count FROM prof_messages WHERE user_id = ? AND created_at > ?`,
        [userId, lastExtraction]
      );
      const messageCount = countRow?.count ?? 0;

      // 2. Ne déclencher que tous les 15 messages
      if (messageCount < MESSAGES_BETWEEN_PATTERN_EXTRACTION) return;

      console.log(`🧠 [Mémoire] Extraction de patterns déclenchée (${messageCount} messages)`);

      // 3. Récupérer les messages récents (30 derniers)
      const messages = db.getAllSync<{ role: string; content: string }>(
        `SELECT role, content FROM prof_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
        [userId]
      );

      if (messages.length < 5) return;

      // Remettre dans l'ordre chronologique
      messages.reverse();

      const conversationText = messages
        .map((m) => `${m.role === 'user' ? 'Enfant' : 'Prof'} : ${m.content}`)
        .join('\n');

      const extractionPrompt = `Tu analyses une conversation éducative pour identifier
ce que le professeur peut apprendre sur les PRÉFÉRENCES et MÉTHODES de l'enfant.

# CONVERSATION
${conversationText}

# TA MISSION
Identifie 1 à 3 observations UTILES sur l'enfant. Chaque observation doit être :
- Concrète et spécifique (pas "il aime apprendre", mais "il préfère les exemples avec des sports")
- Récurrente dans la conversation (pas un one-shot)
- Utile pour adapter les futures explications

# CATÉGORIES POSSIBLES
- interets : centres d'intérêt (sport, animaux, jeux vidéo, musique…)
- methode : manière d'apprendre préférée (exemples concrets, visuels, histoires…)
- forces : matières ou compétences où il excelle
- faiblesses : matières ou compétences où il galère
- motivation : ce qui le motive (défis, encouragement, récompenses…)
- contexte : infos utiles sur son quotidien (jours de sport, activité extrascolaire…)

# FORMAT DE RÉPONSE
Réponds UNIQUEMENT avec un JSON valide, sans texte autour :
{
  "patterns": [
    {"category": "interets", "pattern": "aime les exemples avec des sports"},
    {"category": "methode", "pattern": "préfère les explications courtes"}
  ]
}

Si tu ne trouves rien d'utile, réponds : {"patterns": []}`;

      // 4. Appeler DeepSeek pour extraire
      isProcessingRef.current = true;

      const result = await sendMessageToAgent({
        messages: [{ role: 'user', content: extractionPrompt }],
        agentSystemPrompt: 'Tu extrais des informations utiles en JSON.',
        enableTools: false,
        agentId: 'prof',
      });

      if (!result.reply) {
        isProcessingRef.current = false;
        return;
      }

      // 5. Parser le JSON
      let extracted: { patterns: Array<{ category: string; pattern: string }> } = { patterns: [] };
      try {
        // Nettoyer les backticks éventuels
        const cleaned = result.reply.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
        extracted = JSON.parse(cleaned);
      } catch (e) {
        console.warn('🧠 [Mémoire] Erreur parsing JSON patterns:', e);
        isProcessingRef.current = false;
        return;
      }

      // 6. Sauvegarder chaque pattern
      if (extracted.patterns && Array.isArray(extracted.patterns)) {
        for (const p of extracted.patterns) {
          if (p.category && p.pattern) {
            await saveLearnedPattern(db, userId, p.category, p.pattern);
          }
        }
        console.log(`🧠 [Mémoire] ${extracted.patterns.length} pattern(s) sauvegardé(s)`);
      }

      // 7. Mettre à jour le timestamp de la dernière extraction
      lastPatternExtractionRef.current = Date.now();
      isProcessingRef.current = false;
    } catch (e) {
      console.warn('🧠 [Mémoire] Erreur maybeExtractPatterns:', e);
      isProcessingRef.current = false;
    }
  }, []);

  // ============================================================
  // RESET (pour tests)
  // ============================================================

  const reset = useCallback(() => {
    lastPatternExtractionRef.current = 0;
    isProcessingRef.current = false;
    setLastSummaryId(null);
  }, []);

  return {
    loadContext,
    maybeGenerateSummary,
    maybeExtractPatterns,
    reset,
  };
}