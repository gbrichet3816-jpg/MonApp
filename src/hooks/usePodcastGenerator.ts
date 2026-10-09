// src/hooks/usePodcastGenerator.ts
// 🎙️ Hook React pour orchestrer la génération de podcasts M4A

import {
    deletePodcast,
    generatePodcast,
    PodcastResult,
} from '@/config/podcast';
import { useCallback, useState } from 'react';

export type PodcastStatus =
  | 'idle'           // Rien en cours
  | 'generating'     // TTS en cours
  | 'success'        // Podcast prêt
  | 'error';         // Erreur

export interface PodcastState {
  status: PodcastStatus;
  filePath: string | null;
  fileName: string | null;
  durationMs: number;
  title: string | null;
  error: string | null;
  progress: number;  // 0 à 1 (pour une barre de chargement)
}

export interface UsePodcastGeneratorReturn {
  state: PodcastState;
  generate: (text: string, title: string) => Promise<PodcastResult>;
  cancel: () => void;
  reset: () => void;
  cleanup: () => Promise<void>;
}

const INITIAL_STATE: PodcastState = {
  status: 'idle',
  filePath: null,
  fileName: null,
  durationMs: 0,
  title: null,
  error: null,
  progress: 0,
};

/**
 * 🎙️ Hook qui encapsule toute la logique de génération de podcasts.
 *
 * Usage :
 * ```tsx
 * const { state, generate, reset } = usePodcastGenerator();
 *
 * // Quand Prof appelle createPodcast :
 * await generate(script, 'Les fractions');
 *
 * // state.status === 'success' → afficher le modal
 * // state.filePath → chemin du M4A
 * ```
 */
export function usePodcastGenerator(): UsePodcastGeneratorReturn {
  const [state, setState] = useState<PodcastState>(INITIAL_STATE);

  /**
   * 🎙️ Génère un podcast à partir d'un texte et d'un titre.
   * Met à jour le state pendant la génération.
   */
  const generate = useCallback(
    async (text: string, title: string): Promise<PodcastResult> => {
      // Validation basique
      if (!text || !text.trim()) {
        const error = 'Texte vide';
        setState((prev) => ({ ...prev, status: 'error', error }));
        return { success: false, error };
      }

      // 1. Passer en status "generating"
      setState({
        status: 'generating',
        filePath: null,
        fileName: null,
        durationMs: 0,
        title,
        error: null,
        progress: 0.1,
      });

      try {
        // 2. Simulation de progression (le TTS ne donne pas de %)
        //    On fait progresser doucement de 0.1 à 0.9 pendant la génération.
        const progressInterval = setInterval(() => {
          setState((prev) => {
            if (prev.status !== 'generating') return prev;
            const nextProgress = Math.min(0.9, prev.progress + 0.05);
            return { ...prev, progress: nextProgress };
          });
        }, 300);

        // 3. Appel à la fonction de génération
        const result = await generatePodcast({ text, title });

        // 4. Stopper l'animation de progression
        clearInterval(progressInterval);

        // 5. Traiter le résultat
        if (result.success && result.filePath) {
          setState({
            status: 'success',
            filePath: result.filePath,
            fileName: result.fileName || null,
            durationMs: result.durationMs || 0,
            title,
            error: null,
            progress: 1,
          });
        } else {
          setState({
            status: 'error',
            filePath: null,
            fileName: null,
            durationMs: 0,
            title,
            error: result.error || 'Erreur inconnue',
            progress: 0,
          });
        }

        return result;
      } catch (error: any) {
        console.error('[usePodcastGenerator] Erreur:', error);
        const errorMessage = error?.message || 'Erreur inconnue';
        setState({
          status: 'error',
          filePath: null,
          fileName: null,
          durationMs: 0,
          title,
          error: errorMessage,
          progress: 0,
        });
        return { success: false, error: errorMessage };
      }
    },
    [],
  );

  /**
   * ❌ Annule la génération en cours (ferme le state sans supprimer de fichier).
   * Note : expo-tts-file ne permet pas d'interrompre un TTS en cours côté natif,
   * donc on ne fait que réinitialiser le state visuel.
   */
  const cancel = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  /**
   * 🔄 Réinitialise le state (sans supprimer le fichier généré).
   * À appeler quand le modal est fermé, par exemple.
   */
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  /**
   * 🗑️ Supprime le podcast généré du disque.
   * À appeler si l'utilisateur refuse le podcast après génération.
   */
  const cleanup = useCallback(async () => {
    if (state.filePath) {
      await deletePodcast(state.filePath);
    }
    setState(INITIAL_STATE);
  }, [state.filePath]);

  return {
    state,
    generate,
    cancel,
    reset,
    cleanup,
  };
}