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
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  cleaned = cleaned.replace(/__(.+?)__/g, '$1');
  cleaned = cleaned.replace(/_(.+?)_/g, '$1');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  cleaned = cleaned.replace(/~~(.+?)~~/g, '$1');

  // 4. Retirer les titres markdown (#, ##, ###)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

  // 5. Convertir les tirets de liste en pauses
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, '');

  // 6. Retirer les ponctuations orphelines
  cleaned = cleaned.replace(/\s*[:;]\s*$/gm, '');

  // 7. Retirer les caractères de contrôle invisibles
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 8. Remplacer les sauts de ligne multiples par un point
  cleaned = cleaned.replace(/\n{2,}/g, '. ');
  cleaned = cleaned.replace(/\n/g, ' ');

  // 9. Normaliser les espaces multiples
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  // 10. Retirer les espaces avant ponctuation
  cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1');

  // 11. Retirer les points multiples
  cleaned = cleaned.replace(/\.{2,}/g, '.');

  // 12. Trim final
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * 🆕 Découpe un texte long en morceaux (~400 caractères chacun)
 * en coupant intelligemment aux frontières de phrases.
 */
function splitTextIntoChunks(text: string, maxChunkSize: number = 400): string[] {
  // 1. Découper en phrases
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];

  // 2. Regrouper en chunks
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > maxChunkSize) {
      if (current.trim()) {
        chunks.push(current.trim());
      }
      // Si une seule phrase dépasse maxChunkSize, on la coupe brutalement
      if (sentence.length > maxChunkSize) {
        let remaining = sentence;
        while (remaining.length > maxChunkSize) {
          chunks.push(remaining.slice(0, maxChunkSize).trim());
          remaining = remaining.slice(maxChunkSize);
        }
        current = remaining;
      } else {
        current = sentence;
      }
    } else {
      current += sentence;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * 🆕 Lit un texte LONG en le découpant en morceaux.
 * Enchaîne les lectures bout à bout pour un effet continu.
 */
function speakLongText(
  text: string,
  rate: number,
  onDone?: () => void,
  onError?: () => void
) {
  const chunks = splitTextIntoChunks(text);

  if (chunks.length === 0) {
    isSpeaking = false;
    onDone?.();
    return;
  }

  let currentIndex = 0;

  const speakNext = () => {
    if (currentIndex >= chunks.length) {
      isSpeaking = false;
      onDone?.();
      return;
    }

    const chunk = chunks[currentIndex];
    currentIndex++;

    Speech.speak(chunk, {
      language: 'fr-FR',
      pitch: 1.0,
      rate: rate,
      onDone: () => {
        // Petit délai pour une pause naturelle entre les morceaux
        setTimeout(() => {
          if (isSpeaking) {
            speakNext();
          }
        }, 100);
      },
      onStopped: () => {
        isSpeaking = false;
      },
      onError: (err) => {
        console.warn('[Speech] Erreur sur un chunk:', err);
        // On essaie de continuer malgré tout
        setTimeout(() => {
          if (isSpeaking) {
            speakNext();
          }
        }, 100);
      },
    });
  };

  speakNext();
}

/**
 * Lit un texte à voix haute en français.
 * Le texte est nettoyé avant d'être lu.
 * Pour les textes longs (> 800 car), découpage automatique en morceaux.
 */
export function speakText(text: string, onDone?: () => void) {
  Speech.stop();

  const cleanText = cleanTextForSpeech(text);

  if (!cleanText) {
    onDone?.();
    return;
  }

  isSpeaking = true;

  // 🆕 Si le texte est court, lecture directe
  if (cleanText.length < 800) {
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
        onDone?.();
      },
    });
  } else {
    // 🆕 Sinon, découpage en morceaux
    speakLongText(
      cleanText,
      0.95,
      () => onDone?.(),
      () => onDone?.()
    );
  }
}

/**
 * Lit un texte LENTEMENT (utile pour les dictées).
 * Le texte est nettoyé avant d'être lu.
 * Pour les textes longs (> 800 car), découpage automatique.
 */
export function speakTextSlow(text: string, onDone?: () => void) {
  Speech.stop();

  const cleanText = cleanTextForSpeech(text);

  if (!cleanText) {
    onDone?.();
    return;
  }

  isSpeaking = true;

  if (cleanText.length < 800) {
    Speech.speak(cleanText, {
      language: 'fr-FR',
      pitch: 1.0,
      rate: 0.6,
      onDone: () => {
        isSpeaking = false;
        onDone?.();
      },
      onStopped: () => {
        isSpeaking = false;
      },
      onError: () => {
        isSpeaking = false;
        onDone?.();
      },
    });
  } else {
    speakLongText(
      cleanText,
      0.6,
      () => onDone?.(),
      () => onDone?.()
    );
  }
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