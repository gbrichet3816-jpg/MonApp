// src/utils/visualParser.ts
// Parsing du marqueur __VISUAL__: pour les visuels générés par Prof

export type VisualData = {
  type: 'svg' | 'mermaid' | 'html';
  title: string;
  code: string;
};

/**
 * Détecte et parse un marqueur __VISUAL__ dans une string.
 * Retourne null si aucun marqueur trouvé ou si invalide.
 */
export function parseVisualMarker(text: string): VisualData | null {
  if (!text) return null;

  const markerIndex = text.indexOf('__VISUAL__:');
  if (markerIndex === -1) return null;

  const afterMarker = text.substring(markerIndex + '__VISUAL__:'.length);

  // On cherche le JSON : il commence par { et finit par le dernier } AVANT
  // un éventuel texte qui suit (ou fin de string).
  const jsonStart = afterMarker.indexOf('{');
  if (jsonStart === -1) return null;

  // On extrait du premier { jusqu'au dernier } de la string
  const jsonEnd = afterMarker.lastIndexOf('}');
  if (jsonEnd === -1 || jsonEnd < jsonStart) return null;

  const jsonStr = afterMarker.substring(jsonStart, jsonEnd + 1).trim();

  try {
    const parsed = JSON.parse(jsonStr);

    if (!parsed.type || !parsed.code) {
      console.warn('[VisualParser] Champs manquants:', parsed);
      return null;
    }

    // Validation du type
    const validTypes = ['svg', 'mermaid', 'html'];
    if (!validTypes.includes(parsed.type)) {
      console.warn('[VisualParser] Type invalide:', parsed.type);
      return null;
    }

    return {
      type: parsed.type,
      title: parsed.title || 'Visuel',
      code: parsed.code,
    };
  } catch (e) {
    console.warn('[VisualParser] Erreur parsing JSON:', e);
    return null;
  }
}

/**
 * Extrait le texte propre en retirant TOUT ce qui touche au marqueur __VISUAL__.
 * Retourne uniquement le texte avant le marqueur.
 */
export function stripVisualMarker(text: string): string {
  if (!text) return '';

  const markerIndex = text.indexOf('__VISUAL__:');
  if (markerIndex === -1) return text;

  const beforeMarker = text.substring(0, markerIndex).trim();
  return beforeMarker;
}