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

// 🆕 Unités de mesure courantes (à ignorer si présentes uniquement dans l'attendu)
const UNITS = [
  // Longueur
  'mm', 'cm', 'dm', 'm', 'km', 'micrometre', 'micrometres', 'millimetre', 'millimetres',
  'centimetre', 'centimetres', 'metre', 'metres', 'kilometre', 'kilometres',
  // Masse
  'mg', 'g', 'kg', 't', 'tonne', 'tonnes', 'milligramme', 'milligrammes',
  'gramme', 'grammes', 'kilogramme', 'kilogrammes',
  // Volume
  'ml', 'cl', 'dl', 'l', 'litre', 'litres', 'millilitre', 'millilitres',
  'centilitre', 'centilitres', 'decilitre', 'decilitres',
  // Temps
  's', 'sec', 'seconde', 'secondes', 'min', 'mn', 'minute', 'minutes',
  'h', 'heure', 'heures', 'j', 'jour', 'jours',
  // Température
  'c', 'f', 'k', 'celsius', 'fahrenheit', 'kelvin', 'degres', 'degre',
  // Monnaie
  'euro', 'euros', 'eur', 'centime', 'centimes', 'cent', 'cents',
  // Autres
  'm2', 'm3', 'cm2', 'cm3', 'km2', 'km3', 'ha', 'hectare', 'hectares',
  'pourcent', 'pourcents', 'pour cent',
];

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
 * 🆕 Extrait uniquement les nombres d'une chaîne.
 * Ex : "10 cm" → "10", "3 kg 500 g" → "3 500"
 */
function extractNumbers(s: string): string {
  const matches = s.match(/-?\d+(?:[.,]\d+)?/g);
  if (!matches) return '';
  return matches.join(' ').replace(/,/g, '.');
}

/**
 * 🆕 Vérifie si une chaîne ne contient QUE des nombres et unités.
 * Ex : "10 cm" → true, "il fait 10 cm" → false
 */
function isNumberWithUnit(s: string): boolean {
  const normalized = normalize(s);
  const withoutUnits = normalized
    .split(' ')
    .filter((word) => !UNITS.includes(word))
    .join(' ')
    .trim();
  // Si après retrait des unités, il ne reste que des chiffres et espaces
  return /^[\d\s.,\-]+$/.test(withoutUnits) && withoutUnits.length > 0;
}

/**
 * 🆕 Compare 2 chaînes en ignorant les unités si elles ne sont présentes que d'un côté.
 * Ex : "10" vs "10 cm" → true
 * Ex : "10 cm" vs "10 m" → false (unités différentes mais nombre identique)
 */
function compareNumbersIgnoringUnits(given: string, expected: string): boolean {
  // Au moins une des deux doit être "nombre + unité"
  const givenIsNum = isNumberWithUnit(given);
  const expectedIsNum = isNumberWithUnit(expected);

  if (!givenIsNum && !expectedIsNum) return false;

  // Extraire les nombres des deux côtés
  const givenNums = extractNumbers(given);
  const expectedNums = extractNumbers(expected);

  if (!givenNums || !expectedNums) return false;

  // Les nombres doivent être identiques
  return givenNums === expectedNums;
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
 * - 🆕 Les unités manquantes (« 10 » vs « 10 cm ») ✅
 */
export function answersMatchLocal(given: string, expected: string): boolean {
  if (!given || !expected) return false;

  const normalizedGiven = normalize(given);
  const normalizedExpected = normalize(expected);

  // 1. Comparaison directe après normalisation
  if (normalizedGiven === normalizedExpected) return true;

  // 🆕 2. Comparaison nombre + unité (AVANT les autres règles)
  //    "10" vs "10 cm" → true
  //    "10 cm" vs "10" → true
  //    "10 cm" vs "10 m" → false (nombres identiques mais unités différentes)
  if (compareNumbersIgnoringUnits(given, expected)) {
    // Si les unités sont différentes ET présentes des 2 côtés → refuser
    const givenHasUnit = UNITS.some((u) => normalizedGiven.includes(` ${u}`) || normalizedGiven.endsWith(u));
    const expectedHasUnit = UNITS.some((u) => normalizedExpected.includes(` ${u}`) || normalizedExpected.endsWith(u));

    if (givenHasUnit && expectedHasUnit) {
      // Les deux ont une unité → vérifier qu'elles sont identiques
      const givenUnit = UNITS.find((u) => normalizedGiven.includes(` ${u}`) || normalizedGiven.endsWith(u));
      const expectedUnit = UNITS.find((u) => normalizedExpected.includes(` ${u}`) || normalizedExpected.endsWith(u));
      if (givenUnit !== expectedUnit) return false;
    }

    return true;
  }

  // 3. Comparaison après retrait des mots vides
  const givenNoStop = removeStopWords(normalizedGiven);
  const expectedNoStop = removeStopWords(normalizedExpected);

  if (givenNoStop === expectedNoStop) return true;
  if (!givenNoStop || !expectedNoStop) return false;

  // 4. Si la réponse attendue est contenue dans la donnée (ou inversement)
  if (givenNoStop.includes(expectedNoStop) || expectedNoStop.includes(givenNoStop)) {
    const minLen = Math.min(givenNoStop.length, expectedNoStop.length);
    if (minLen >= 3) return true;
  }

  // 5. Similarité par distance de Levenshtein (fautes de frappe)
  if (isSimilar(givenNoStop, expectedNoStop)) return true;

  // 6. Comparaison mot à mot (si 2 mots, on tolère si l'un contient l'autre)
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