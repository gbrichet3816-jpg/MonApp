// src/utils/answerMatch.ts
// Comparaison tolérante pour les réponses de quiz

// Mots vides français à retirer (articles, prépositions, verbes courants)
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd',
  'l', 'en', 'a', 'au', 'aux', 'et', 'ou', 'mais', 'car', 'donc', 'or', 'ni', 'puis',
  'est', 'etait', 'sont', 'etaient', 'fut', 'sera', 'seront',
  'c', 'ce', 'cet', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
  'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
  'il', 'elle', 'ils', 'elles', 'je', 'tu', 'nous', 'vous', 'on',
  'que', 'qui', 'quoi', 'dont', 'ou', 'sur', 'sous', 'dans', 'par', 'pour',
  'avec', 'sans', 'vers', 'chez', 'entre', 'contre',
]);

/**
 * Normalise une chaîne :
 * - minuscules
 * - sans accents
 * - sans ponctuation
 * - sans espaces multiples
 */
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!?;:'"()\[\]{}]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Retire les mots vides d'une chaîne normalisée.
 */
function removeStopWords(s: string): string {
  return s
    .split(' ')
    .filter((word) => !STOP_WORDS.has(word) && word.length > 0)
    .join(' ');
}

/**
 * Distance de Levenshtein.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}

/**
 * Vérifie si 2 chaînes sont similaires avec une tolérance de fautes.
 */
function isSimilar(a: string, b: string, tolerance: number = 2): boolean {
  if (a === b) return true;
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const allowed = Math.min(tolerance, Math.max(1, Math.floor(maxLen * 0.2)));
  return distance <= allowed;
}

/**
 * 🎯 Comparaison tolérante entre la réponse donnée et la réponse attendue.
 *
 * Tolère :
 * - Les articles/prépositions/mots vides (« en 1945 » vs « 1945 ») ✅
 * - Les fautes de frappe légères (« Hittler » vs « Hitler ») ✅
 * - Les accents (« Mathéo » vs « Matheo ») ✅
 * - Les mots en trop (« Adolph Hitler » vs « Hitler ») ✅ si l'un contient l'autre
 */
export function answersMatchLocal(given: string, expected: string): boolean {
  if (!given || !expected) return false;

  const normalizedGiven = normalize(given);
  const normalizedExpected = normalize(expected);

  // 1. Comparaison directe après normalisation
  if (normalizedGiven === normalizedExpected) return true;

  // 2. Comparaison après retrait des mots vides
  const givenNoStop = removeStopWords(normalizedGiven);
  const expectedNoStop = removeStopWords(normalizedExpected);

  if (givenNoStop === expectedNoStop) return true;
  if (!givenNoStop || !expectedNoStop) return false;

  // 3. Si la réponse attendue est contenue dans la donnée (ou inversement)
  if (givenNoStop.includes(expectedNoStop) || expectedNoStop.includes(givenNoStop)) {
    const minLen = Math.min(givenNoStop.length, expectedNoStop.length);
    if (minLen >= 3) return true;
  }

  // 4. Similarité par distance de Levenshtein (fautes de frappe)
  if (isSimilar(givenNoStop, expectedNoStop)) return true;

  // 5. Comparaison mot à mot (si 2 mots, on tolère si l'un contient l'autre)
  const givenWords = givenNoStop.split(' ').filter((w) => w.length >= 2);
  const expectedWords = expectedNoStop.split(' ').filter((w) => w.length >= 2);

  if (givenWords.length > 0 && expectedWords.length > 0) {
    const allExpectedPresent = expectedWords.every((expWord) =>
      givenWords.some((givenWord) => isSimilar(givenWord, expWord)),
    );
    if (allExpectedPresent) return true;
  }

  return false;
}

/**
 * 🎯 Détecte si la réponse est "presque" juste (à envoyer à l'IA).
 */
export function looksAlmostCorrect(given: string, expected: string): boolean {
  if (!given || !expected) return false;

  const normalizedGiven = normalize(given);
  const normalizedExpected = normalize(expected);

  if (answersMatchLocal(given, expected)) return true;

  const lenDiff = Math.abs(normalizedGiven.length - normalizedExpected.length);
  const maxLen = Math.max(normalizedGiven.length, normalizedExpected.length);

  return lenDiff < maxLen * 0.5;
}