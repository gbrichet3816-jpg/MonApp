// src/config/speech.ts
// Lecture à voix haute + nettoyage + découpage intelligent

import * as Speech from 'expo-speech';

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
// DÉCOUPAGE PAR BLOCS (UNIQUEMENT pour les textes > 3500 caractères)
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
// DÉCOUPAGE INTELLIGENT (UNIQUEMENT pour la DICTÉE)
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

function speakSegments(
  segments: SpeechSegment[],
  rate: number,
  onDone?: () => void
) {
  if (segments.length === 0) {
    isSpeaking = false;
    onDone?.();
    return;
  }

  let currentIndex = 0;

  const speakNext = () => {
    if (currentIndex >= segments.length) {
      isSpeaking = false;
      onDone?.();
      return;
    }

    const segment = segments[currentIndex];
    currentIndex++;

    Speech.speak(segment.text, {
      language: 'fr-FR',
      pitch: 1.0,
      rate: rate,
      onDone: () => {
        setTimeout(() => {
          if (isSpeaking) speakNext();
        }, segment.pauseAfterMs);
      },
      onStopped: () => { isSpeaking = false; },
      onError: () => {
        setTimeout(() => {
          if (isSpeaking) speakNext();
        }, 300);
      },
    });
  };

  speakNext();
}

// ============================================================
// LECTURE DE BLOCS (chat normal — pour textes > 3500 car uniquement)
// ============================================================

function speakBlocks(
  blocks: string[],
  rate: number,
  onDone?: () => void
) {
  if (blocks.length === 0) {
    isSpeaking = false;
    onDone?.();
    return;
  }

  let currentIndex = 0;

  const speakNext = () => {
    if (currentIndex >= blocks.length) {
      isSpeaking = false;
      onDone?.();
      return;
    }

    const block = blocks[currentIndex];
    currentIndex++;

    Speech.speak(block, {
      language: 'fr-FR',
      pitch: 1.0,
      rate: rate,
      onDone: () => {
        setTimeout(() => {
          if (isSpeaking) speakNext();
        }, 100);
      },
      onStopped: () => { isSpeaking = false; },
      onError: () => {
        setTimeout(() => {
          if (isSpeaking) speakNext();
        }, 100);
      },
    });
  };

  speakNext();
}

// ============================================================
// FONCTIONS PUBLIQUES
// ============================================================

/**
 * Lit un texte à voix haute NORMALEMENT (chat classique).
 * ✅ LECTURE D'UN BLOC, PAS DE COUPURE
 * (sauf si le texte dépasse 3500 caractères → découpage par blocs silencieux)
 */
export function speakText(text: string, onDone?: () => void) {
  Speech.stop();

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    onDone?.();
    return;
  }

  isSpeaking = true;

  if (cleanText.length <= 3500) {
    // ✅ LECTURE D'UN BLOC — pas de coupure
    Speech.speak(cleanText, {
      language: 'fr-FR',
      pitch: 1.0,
      rate: 0.95,
      onDone: () => {
        isSpeaking = false;
        onDone?.();
      },
      onStopped: () => { isSpeaking = false; },
      onError: () => {
        isSpeaking = false;
        onDone?.();
      },
    });
  } else {
    // Texte très long (> 3500 car) → découpage par blocs
    const blocks = splitIntoBlocks(cleanText);
    speakBlocks(blocks, 0.95, onDone);
  }
}

/**
 * Lit un texte LENTEMENT pour une dictée.
 * ✅ DÉCOUPAGE INTELLIGENT avec pauses longues
 */
export function speakTextSlow(text: string, onDone?: () => void) {
  Speech.stop();

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

export function stopSpeaking() {
  Speech.stop();
  isSpeaking = false;
}

export async function getFrenchVoices() {
  const voices = await Speech.getAvailableVoicesAsync();
  return voices.filter((v) => v.language.startsWith('fr'));
}