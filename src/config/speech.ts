// src/config/speech.ts
// Lecture à voix haute : nettoyage + découpage + délégation à tts.ts

import * as Speech from 'expo-speech';
import {
  isSupertonicAvailable,
  speak as ttsSpeak,
  stop as ttsStop,
} from './tts';

let isSpeaking = false;

export function getIsSpeaking() {
  return isSpeaking;
}

// ============================================================
// NETTOYAGE DU TEXTE
// ============================================================

export function cleanTextForSpeech(text: string): string {
  if (!text) return '';

  let cleaned = text;

  cleaned = cleaned.replace(
    /[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu,
    ''
  );
  cleaned = cleaned.replace(/[•●○◦‣⁃∙·]/g, '');
  cleaned = cleaned.replace(/[⚠️✅❌✔️✖️🔴🟠🟡🟢🔵🟣⚫⚪]/gu, '');
  cleaned = cleaned.replace(/[→←↑↓➡️⬅️]/gu, '');
  cleaned = cleaned.replace(/[★☆♥♦♣♠]/g, '');
  cleaned = cleaned.replace(/[「」『』【】《》]/g, '');

  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  cleaned = cleaned.replace(/__(.+?)__/g, '$1');
  cleaned = cleaned.replace(/_(.+?)_/g, '$1');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  cleaned = cleaned.replace(/~~(.+?)~~/g, '$1');

  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, '');
  cleaned = cleaned.replace(/\s*[:;]\s*$/gm, '');
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
  cleaned = cleaned.replace(/\n{2,}/g, '. ');
  cleaned = cleaned.replace(/\n/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1');
  cleaned = cleaned.replace(/\.{2,}/g, '.');

  return cleaned.trim();
}

// ============================================================
// DÉCOUPAGE PAR BLOCS (textes très longs)
// ============================================================

function splitIntoBlocks(text: string, maxSize: number = 3500): string[] {
  if (text.length <= maxSize) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  const blocks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if ((current + s).length > maxSize) {
      if (current.trim()) blocks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) blocks.push(current.trim());
  return blocks;
}

// ============================================================
// DÉCOUPAGE INTELLIGENT (dictée)
// ============================================================

export interface SpeechSegment {
  text: string;
  pauseAfterMs: number;
}

export function smartSplit(text: string): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  const MAX_WORDS = 10;

  const breakPattern = /([.!?;:,]|\s+(?:pendant que|parce que|lorsque|puisque|tandis que|alors que|bien que|afin que)\s+|\s+(?:et|mais|ou|car|donc|or|ni|puis)\s+)/gi;

  const parts = text.split(breakPattern).filter((p) => p && p.trim().length > 0);

  let current = '';
  let currentWords = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const partWords = trimmed.split(/\s+/).length;
    const isPunctuation = /^[.!?;:,]$/.test(trimmed);
    const isConjunction = /^(pendant que|parce que|lorsque|puisque|tandis que|alors que|bien que|afin que|et|mais|ou|car|donc|or|ni|puis)$/i.test(trimmed);

    if (isPunctuation) {
      current += trimmed;
      let pause = 500;
      if (trimmed === '.' || trimmed === '!' || trimmed === '?') pause = 1000;
      else if (trimmed === ';') pause = 700;
      else if (trimmed === ':') pause = 600;
      else if (trimmed === ',') pause = 500;

      const textToSpeak = current.trim();
      if (textToSpeak) {
        segments.push({ text: textToSpeak, pauseAfterMs: pause });
      }
      current = '';
      currentWords = 0;
    } else if (isConjunction) {
      const textToSpeak = current.trim();
      if (textToSpeak) {
        const pause = /pendant que|parce que|lorsque|puisque|tandis que|alors que|bien que|afin que/i.test(trimmed) ? 700 : 600;
        segments.push({ text: textToSpeak, pauseAfterMs: pause });
      }
      current = trimmed + ' ';
      currentWords = partWords;
    } else {
      current += (current ? ' ' : '') + trimmed;
      currentWords += partWords;

      if (currentWords >= MAX_WORDS) {
        const textToSpeak = current.trim();
        if (textToSpeak) {
          segments.push({ text: textToSpeak, pauseAfterMs: 400 });
        }
        current = '';
        currentWords = 0;
      }
    }
  }

  if (current.trim()) {
    segments.push({ text: current.trim(), pauseAfterMs: 600 });
  }

  return segments;
}

// ============================================================
// LECTURE DE SEGMENTS (dictée)
// ============================================================

async function speakSegments(
  segments: SpeechSegment[],
  rate: number,
  onDone?: () => void
): Promise<void> {
  if (segments.length === 0) {
    isSpeaking = false;
    onDone?.();
    return;
  }

  let currentIndex = 0;

  const speakNext = async () => {
    if (currentIndex >= segments.length) {
      isSpeaking = false;
      onDone?.();
      return;
    }

    const segment = segments[currentIndex];
    currentIndex++;

    await ttsSpeak(segment.text, rate, {
      onDone: () => {
        setTimeout(() => {
          if (isSpeaking) speakNext();
        }, segment.pauseAfterMs);
      },
      onStopped: () => {
        isSpeaking = false;
      },
      onError: () => {
        setTimeout(() => {
          if (isSpeaking) speakNext();
        }, 300);
      },
    });
  };

  await speakNext();
}

// ============================================================
// LECTURE DE BLOCS (chat normal — textes > 3500 car)
// ============================================================

async function speakBlocks(
  blocks: string[],
  rate: number,
  onDone?: () => void
): Promise<void> {
  if (blocks.length === 0) {
    isSpeaking = false;
    onDone?.();
    return;
  }

  let currentIndex = 0;

  const speakNext = async () => {
    if (currentIndex >= blocks.length) {
      isSpeaking = false;
      onDone?.();
      return;
    }

    const block = blocks[currentIndex];
    currentIndex++;

    await ttsSpeak(block, rate, {
      onDone: () => {
        setTimeout(() => {
          if (isSpeaking) speakNext();
        }, 100);
      },
      onStopped: () => {
        isSpeaking = false;
      },
      onError: () => {
        setTimeout(() => {
          if (isSpeaking) speakNext();
        }, 100);
      },
    });
  };

  await speakNext();
}

// ============================================================
// FONCTIONS PUBLIQUES
// ============================================================

/**
 * Lit un texte à voix haute NORMALEMENT (chat classique).
 * Vitesse : 1.05 (naturel, légèrement plus rapide que 1.0).
 */
export function speakText(text: string, onDone?: () => void) {
  ttsStop();

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    onDone?.();
    return;
  }

  isSpeaking = true;

  if (cleanText.length <= 3500) {
    // Lecture d'un seul bloc
    ttsSpeak(cleanText, 1.05, {
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
    // Texte très long → découpage par blocs
    const blocks = splitIntoBlocks(cleanText);
    speakBlocks(blocks, 1.05, onDone);
  }
}

/**
 * Lit un texte LENTEMENT pour une dictée.
 * Vitesse : 0.6 (lente, adaptée pour écrire).
 * ⚠️ NE PAS MODIFIER cette vitesse — elle est calibrée pour la dictée.
 */
export function speakTextSlow(text: string, onDone?: () => void) {
  ttsStop();

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    onDone?.();
    return;
  }

  isSpeaking = true;
  const segments = smartSplit(cleanText);
  const dictationSegments = segments.map((s) => ({
    ...s,
    pauseAfterMs: Math.max(s.pauseAfterMs, 1200),
  }));

  speakSegments(dictationSegments, 0.6, onDone);
}

/**
 * Arrête la lecture en cours.
 */
export function stopSpeaking() {
  ttsStop();
  isSpeaking = false;
}

/**
 * Vérifie si des voix françaises sont disponibles (expo-speech).
 */
export async function getFrenchVoices() {
  const voices = await Speech.getAvailableVoicesAsync();
  return voices.filter((v) => v.language.startsWith('fr'));
}

// Re-export pour simplifier
export { isSupertonicAvailable };
