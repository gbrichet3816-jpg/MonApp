// src/utils/visualParser.ts
// Parsing du marqueur __VISUAL__: pour les visuels générés par Prof

export type VisualData = {
  type: 'svg' | 'mermaid' | 'html';
  title: string;
  code: string;
};

/**
 * Détecte et parse un marqueur __VISUAL__ dans une string.
 * Retourne null si aucun marqueur trouvé.
 */
export function parseVisualMarker(text: string): VisualData | null {
  if (!text) return null;

  const markerIndex = text.indexOf('__VISUAL__:');
  if (markerIndex === -1) return null;

  const jsonStr = text.substring(markerIndex + '__VISUAL__:'.length).trim();

  try {
    const parsed = JSON.parse(jsonStr);

    if (!parsed.type || !parsed.code) {
      return null;
    }

    return {
      type: parsed.type,
      title: parsed.title || 'Visuel',
      code: parsed.code,
    };
  } catch (e) {
    console.warn('[VisualParser] Erreur parsing:', e);
    return null;
  }
}

/**
 * Extrait le texte propre en retirant le marqueur __VISUAL__.
 */
export function stripVisualMarker(text: string): string {
  if (!text) return '';

  const markerIndex = text.indexOf('__VISUAL__:');
  if (markerIndex === -1) return text;

  // Cherche la fin du JSON (dernier } avant fin de string ou avant un nouveau texte)
  const beforeMarker = text.substring(0, markerIndex).trim();
  return beforeMarker;
}