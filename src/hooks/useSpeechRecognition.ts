import { useCallback, useRef, useState } from 'react';

type UseSpeechRecognitionProps = {
  onResult: (text: string) => void;
  /** 🆕 Si true, on court-circuite complètement les événements (micro inactif) */
  disabled?: boolean;
};

// Charge le module de manière sécurisée (ne plante pas dans Expo Go)
let SpeechModule: any = null;
let useSpeechEvent: any = () => {};

try {
  const SpeechRecognition = require('expo-speech-recognition');
  SpeechModule = SpeechRecognition.ExpoSpeechRecognitionModule;
  useSpeechEvent = SpeechRecognition.useSpeechRecognitionEvent;
} catch (e) {
  // Module non disponible (Expo Go) — on continue quand même
}

export function useSpeechRecognition({ onResult, disabled = false }: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTranscriptRef = useRef<string>('');

  // Résultat de la reconnaissance vocale
  useSpeechEvent('result', (event: any) => {
    // 🆕 Si le hook est désactivé, on ignore complètement
    if (disabled) return;

    const results = event.results || [];
    const lastResult = results[results.length - 1];
    const transcript = lastResult?.transcript || '';

    if (transcript && transcript.trim().length > 0) {
      lastTranscriptRef.current = transcript;
      onResult(transcript);
    }
  });

  // Event 'end' : on renvoie le dernier transcript connu au parent
  useSpeechEvent('end', () => {
    // 🆕 Si désactivé, on n'envoie rien
    if (disabled) {
      setIsListening(false);
      return;
    }

    const finalTranscript = lastTranscriptRef.current;
    if (finalTranscript && finalTranscript.trim().length > 0) {
      onResult(finalTranscript);
    }
    setIsListening(false);
  });

  useSpeechEvent('error', (event: any) => {
    if (disabled) return;
    setError(event.error);
    setIsListening(false);
  });

  const start = useCallback(async () => {
    // 🆕 Si désactivé, on ne démarre pas
    if (disabled) {
      return;
    }

    if (!SpeechModule) {
      setError('module-unavailable');
      throw new Error('Speech module unavailable');
    }

    setError(null);
    lastTranscriptRef.current = '';

    const permission = await SpeechModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('permission-denied');
      return;
    }

    SpeechModule.start({
      lang: 'fr-FR',
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 10000,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 10000,
        EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 500,
        EXTRA_MASK_OFFENSIVE_WORDS: false,
      },
      iosTaskHint: 'unspecified',
    });

    setIsListening(true);
  }, [disabled]);

  const stop = useCallback(() => {
    if (SpeechModule) SpeechModule.stop();
    setIsListening(false);
  }, []);

  const cancel = useCallback(() => {
    if (SpeechModule) SpeechModule.abort();
    setIsListening(false);
    lastTranscriptRef.current = '';
  }, []);

  return { isListening, error, start, stop, cancel };
}