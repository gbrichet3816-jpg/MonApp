// src/config/tts.ts
// Gestion de la synthèse vocale : Supertonic-3 (react-native-tts-kit) avec fallback expo-speech

import * as Speech from 'expo-speech';

// Import sécurisé du module natif (ne plante pas dans Expo Go)
let TTSKit: any = null;
try {
  const mod = require('react-native-tts-kit');
  TTSKit = mod.default || mod;
} catch (e) {
  console.warn('[TTS] react-native-tts-kit non disponible, fallback expo-speech');
}

// État global
let isModelDownloaded = false;
let isDownloading = false;
let currentEngine: 'supertonic' | 'system' = 'system';

/**
 * Vérifie si le modèle Supertonic-3 est disponible.
 */
export function isSupertonicAvailable(): boolean {
  return TTSKit !== null && isModelDownloaded;
}

/**
 * Récupère l'état actuel du moteur.
 */
export function getCurrentEngine(): 'supertonic' | 'system' {
  return currentEngine;
}

/**
 * Marque le modèle comme téléchargé (appelé après prefetchModel réussi).
 */
export function setModelDownloaded(downloaded: boolean): void {
  isModelDownloaded = downloaded;
  if (downloaded) {
    currentEngine = 'supertonic';
  } else {
    currentEngine = 'system';
  }
}

/**
 * Télécharge le modèle Supertonic-3 (~210 Mo).
 * @param onProgress - Callback avec le pourcentage (0-100)
 * @returns true si le téléchargement a réussi
 */
export async function downloadModel(
  onProgress?: (percent: number) => void
): Promise<boolean> {
  if (!TTSKit) {
    console.warn('[TTS] Supertonic-3 non disponible');
    return false;
  }

  if (isModelDownloaded) {
    return true;
  }

  if (isDownloading) {
    console.warn('[TTS] Téléchargement déjà en cours');
    return false;
  }

  try {
    isDownloading = true;
    console.log('[TTS] Démarrage du téléchargement Supertonic-3...');

    await TTSKit.prefetchModel((p: any) => {
      const percent = p?.percent ?? 0;
      console.log(`[TTS] Téléchargement : ${percent}%`);
      onProgress?.(percent);
    });

    isModelDownloaded = true;
    isDownloading = false;
    currentEngine = 'supertonic';
    console.log('[TTS] Modèle Supertonic-3 téléchargé avec succès');
    return true;
  } catch (e) {
    isDownloading = false;
    console.error('[TTS] Erreur téléchargement:', e);
    return false;
  }
}

/**
 * Parle avec Supertonic-3 (voix naturelle).
 * Retourne false si Supertonic-3 n'est pas disponible.
 */
async function speakWithSupertonic(
  text: string,
  rate: number
): Promise<boolean> {
  if (!isSupertonicAvailable()) return false;

  try {
    // Le paramètre rate n'est pas supporté directement par TTSKit
    // On l'ignore pour l'instant, on pourra l'ajouter plus tard
    await TTSKit.speak(text, {
      voice: 'F1',
      language: 'fr',
    });
    return true;
  } catch (e) {
    console.warn('[TTS] Erreur Supertonic-3, fallback expo-speech:', e);
    return false;
  }
}

/**
 * Parle avec expo-speech (fallback système).
 */
function speakWithSystem(
  text: string,
  rate: number,
  onDone?: () => void,
  onStopped?: () => void,
  onError?: () => void
): void {
  Speech.speak(text, {
    language: 'fr-FR',
    pitch: 1.0,
    rate: rate,
    onDone: onDone,
    onStopped: onStopped,
    onError: onError,
  });
}

/**
 * Fonction unifiée : essaie Supertonic-3, sinon fallback expo-speech.
 */
export async function speak(
  text: string,
  rate: number,
  callbacks?: {
    onDone?: () => void;
    onStopped?: () => void;
    onError?: () => void;
  }
): Promise<void> {
  // Essayer Supertonic-3 d'abord
  if (isSupertonicAvailable()) {
    const success = await speakWithSupertonic(text, rate);
    if (success) {
      // On ne sait pas quand TTSKit finit (pas de callback onDone dans la doc)
      // On simule un onDone après un délai proportionnel à la longueur
      const estimatedDuration = Math.max(1000, text.length * 60);
      setTimeout(() => {
        callbacks?.onDone?.();
      }, estimatedDuration);
      return;
    }
    // Si ça échoue, on passe au fallback
  }

  // Fallback expo-speech
  speakWithSystem(
    text,
    rate,
    callbacks?.onDone,
    callbacks?.onStopped,
    callbacks?.onError
  );
}

/**
 * Arrête la lecture en cours.
 */
export async function stop(): Promise<void> {
  try {
    if (TTSKit) {
      await TTSKit.stop();
    }
  } catch (e) {
    // ignore
  }
  Speech.stop();
}

/**
 * Récupère la liste des voix disponibles (Supertonic-3).
 */
export async function getVoices(): Promise<any[]> {
  if (!TTSKit) return [];
  try {
    return await TTSKit.getVoices();
  } catch (e) {
    console.warn('[TTS] Impossible de récupérer les voix:', e);
    return [];
  }
}