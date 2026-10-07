import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorderState,
    useAudioRecorder as useExpoAudioRecorder,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes

type Params = {
  /** Callback appelé quand l'enregistrement est terminé (validation) */
  onRecorded: (uri: string, durationMs: number) => void;
  /** Désactive complètement l'enregistreur (ex: pendant un quiz) */
  disabled?: boolean;
};

export function useAudioRecorder({ onRecorded, disabled = false }: Params) {
  const recorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number>(0);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef<boolean>(false);

  // Nettoyage
  useEffect(() => {
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Demande de permission au premier lancement
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert(
          'Micro non autorisé',
          'Autorise le micro dans les paramètres de ton téléphone pour enregistrer un audio.',
        );
        return false;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      return true;
    } catch (e) {
      console.warn('[Audio] Permission error:', e);
      return false;
    }
  }, []);

  const start = useCallback(async () => {
    if (disabled || isRecording) return;

    const ok = await ensurePermission();
    if (!ok) return;

    try {
      cancelledRef.current = false;
      await recorder.prepareToRecordAsync();
      recorder.record();

      startTimeRef.current = Date.now();
      setElapsedMs(0);
      setIsRecording(true);

      // Timer visuel toutes les 200 ms
      intervalRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 200);

      // Arrêt auto à 5 min
      autoStopRef.current = setTimeout(() => {
        console.log('[Audio] Limite 5 min atteinte — arrêt auto');
        stopAndValidate(true);
      }, MAX_DURATION_MS);
    } catch (e) {
      console.warn('[Audio] Erreur démarrage:', e);
      Alert.alert('Erreur', "Impossible de démarrer l'enregistrement.");
    }
  }, [disabled, isRecording, recorder, ensurePermission]);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  const stopAndValidate = useCallback(
    async (auto = false) => {
      if (!isRecording) return;

      clearTimers();

      try {
        await recorder.stop();
        const uri = recorder.uri;
        const duration = Date.now() - startTimeRef.current;

        setIsRecording(false);
        setElapsedMs(0);

        if (cancelledRef.current) {
          cancelledRef.current = false;
          return;
        }

        if (!uri) {
          Alert.alert('Erreur', "L'enregistrement a échoué.");
          return;
        }

        if (!auto && duration < 500) {
          // Trop court → on ignore
          Alert.alert('Trop court', 'Enregistre au moins une seconde.');
          return;
        }

        onRecorded(uri, duration);
      } catch (e) {
        console.warn('[Audio] Erreur arrêt:', e);
        setIsRecording(false);
        setElapsedMs(0);
      }
    },
    [isRecording, recorder, clearTimers, onRecorded],
  );

  const cancel = useCallback(async () => {
    if (!isRecording) return;
    cancelledRef.current = true;
    clearTimers();

    try {
      await recorder.stop();
    } catch (e) {
      console.warn('[Audio] Erreur annulation:', e);
    } finally {
      setIsRecording(false);
      setElapsedMs(0);
    }
  }, [isRecording, recorder, clearTimers]);

  return {
    isRecording,
    elapsedMs,
    maxDurationMs: MAX_DURATION_MS,
    start,
    stop: stopAndValidate,
    cancel,
    /** État fourni par expo-audio (utile pour un VU-mètre plus tard) */
    recorderState,
  };
}