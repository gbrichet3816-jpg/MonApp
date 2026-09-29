import * as Speech from 'expo-speech';

// État global (simple pour l'instant)
let isSpeaking = false;

// Retourne true si une lecture est en cours
export function getIsSpeaking() {
  return isSpeaking;
}

// Lit un texte à voix haute en français
export function speakText(text: string, onDone?: () => void) {
  // Arrête toute lecture en cours
  Speech.stop();

  // Nettoie le texte (supprime le markdown basique)
  const cleanText = text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#/g, '')
    .replace(/`/g, '')
    .trim();

  if (!cleanText) return;

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

// Arrête la lecture en cours
export function stopSpeaking() {
  Speech.stop();
  isSpeaking = false;
}

// Vérifie si des voix françaises sont disponibles
export async function getFrenchVoices() {
  const voices = await Speech.getAvailableVoicesAsync();
  return voices.filter((v) => v.language.startsWith('fr'));
}