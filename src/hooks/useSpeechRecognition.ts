import { useCallback, useState } from 'react';

type UseSpeechRecognitionProps = {
  onResult: (text: string) => void;
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

export function useSpeechRecognition({ onResult }: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Résultat de la reconnaissance vocale
  useSpeechEvent('result', (event: any) => {
    const transcript = event.results[0]?.transcript || '';
    if (transcript) {
      onResult(transcript);
    }
  });

  useSpeechEvent('end', () => {
    setIsListening(false);
  });

  useSpeechEvent('error', (event: any) => {
    setError(event.error);
    setIsListening(false);
  });

  const start = useCallback(async () => {
    if (!SpeechModule) {
      setError('module-unavailable');
      throw new Error('Speech module unavailable');
    }

    setError(null);

    const permission = await SpeechModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('permission-denied');
      return;
    }

    SpeechModule.start({
      lang: 'fr-FR',
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
    });

    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    if (SpeechModule) SpeechModule.stop();
    setIsListening(false);
  }, []);

  const cancel = useCallback(() => {
    if (SpeechModule) SpeechModule.abort();
    setIsListening(false);
  }, []);

  return { isListening, error, start, stop, cancel };
}