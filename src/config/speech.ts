// src/config/speech.ts
// Lecture à voix haute + nettoyage intelligent du texte

import * as Speech from 'expo-speech';

let isSpeaking = false;

/**
 * Retourne true si une lecture est en cours.
 */
export function getIsSpeaking() {
  return isSpeaking;
}

/**
 * Nettoie un texte pour la lecture à voix haute :
 * - Retire les emojis
 * - Retire les symboles décoratifs (•, →, ⚠️, ✅, ❌, etc.)
 * - Retire le markdown (**gras**, _italique_, `code`, #, ##)
 * - Remplace les tirets de liste par des pauses
 * - Normalise les espaces
 * - Retire les ponctuations orphelines
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Retirer les emojis et pictogrammes Unicode
  cleaned = cleaned.replace(
    /[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu,
    ''
  );

  // 2. Retirer les symboles décoratifs fréquents
  cleaned = cleaned.replace(/[•●○◦‣⁃∙·]/g, '');
  cleaned = cleaned.replace(/[⚠️✅❌✔️✖️🔴🟠🟡🟢🔵🟣⚫⚪]/gu, '');
  cleaned = cleaned.replace(/[→←↑↓➡️⬅️]/gu, '');
  cleaned = cleaned.replace(/[★☆♥♦♣♠]/g, '');
  cleaned = cleaned.replace(/[「」『』【】《》]/g, '');

  // 3. Retirer le markdown
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1'); // **gras**
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');     // *italique*
  cleaned = cleaned.replace(/__(.+?)__/g, '$1');     // __gras__
  cleaned = cleaned.replace(/_(.+?)_/g, '$1');       // _italique_
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');     // `code`
  cleaned = cleaned.replace(/~~(.+?)~~/g, '$1');     // ~~barré~~

  // 4. Retirer les titres markdown (#, ##, ###)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

  // 5. Convertir les tirets de liste en pauses (retirer le "-" en début de ligne)
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, '');

  // 6. Convertir les numéros de liste "1." "2." en gardant le chiffre (utile à l'oral)
  //    (on les garde tels quels, la TTS lit bien "1." comme "un")

  // 7. Retirer les deux-points orphelins et autres ponctuations bizarres
  cleaned = cleaned.replace(/\s*[:;]\s*$/gm, '');

  // 8. Retirer les caractères de contrôle invisibles
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 9. Remplacer les sauts de ligne multiples par un point (pause)
  cleaned = cleaned.replace(/\n{2,}/g, '. ');
  cleaned = cleaned.replace(/\n/g, ' ');

  // 10. Normaliser les espaces multiples
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  // 11. Retirer les espaces avant ponctuation
  cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1');

  // 12. Retirer les points multiples
  cleaned = cleaned.replace(/\.{2,}/g, '.');

  // 13. Trim final
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Lit un texte à voix haute en français.
 * Le texte est nettoyé avant d'être lu (retire emojis, markdown, symboles).
 */
export function speakText(text: string, onDone?: () => void) {
  Speech.stop();

  const cleanText = cleanTextForSpeech(text);

  if (!cleanText) {
    onDone?.();
    return;
  }

  isSpeaking = true;

  Speech.speak(cleanText, {
    language: 'fr-FR',
    pitch: 1.0,
    rate: 0.95,
    onDone: () => {
      isSpeaking = false;
      onDone?.();
    },
    onStopped: () => {
      isSpeaking = false;
    },
    onError: () => {
      isSpeaking = false;
    },
  });
}

/**
 * Lit un texte lentement (utile pour les dictées).
 * Le texte est nettoyé avant d'être lu.
 */
export function speakTextSlow(text: string, onDone?: () => void) {
  Speech.stop();

  const cleanText = cleanTextForSpeech(text);

  if (!cleanText) {
    onDone?.();
    return;
  }

  isSpeaking = true;

  Speech.speak(cleanText, {
    language: 'fr-FR',
    pitch: 1.0,
    rate: 0.6, // ← plus lent pour les dictées
    onDone: () => {
      isSpeaking = false;
      onDone?.();
    },
    onStopped: () => {
      isSpeaking = false;
    },
    onError: () => {
      isSpeaking = false;
    },
  });
}

/**
 * Arrête la lecture en cours.
 */
export function stopSpeaking() {
  Speech.stop();
  isSpeaking = false;
}

/**
 * Vérifie si des voix françaises sont disponibles.
 */
export async function getFrenchVoices() {
  const voices = await Speech.getAvailableVoicesAsync();
  return voices.filter((v) => v.language.startsWith('fr'));
}