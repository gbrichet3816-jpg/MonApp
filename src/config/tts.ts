// src/config/tts.ts
// Synthèse vocale : expo-speech uniquement (voix système Android/Google)

import * as Speech from 'expo-speech';

/**
 * Parle avec la voix système (Google sur Android).
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
  Speech.speak(text, {
    language: 'fr-FR',
    pitch: 1.0,
    rate: rate,
    onDone: callbacks?.onDone,
    onStopped: callbacks?.onStopped,
    onError: callbacks?.onError,
  });
}

/**
 * Arrête la lecture en cours.
 */
export async function stop(): Promise<void> {
  Speech.stop();
}

/**
 * Conservé pour compatibilité avec speech.ts (toujours false ici).
 */
export function isSupertonicAvailable(): boolean {
  return false;
}