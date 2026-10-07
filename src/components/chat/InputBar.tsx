import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import FileImporter, { ImportedFile } from './FileImporter';

type Props = {
  onSend: (text: string) => void;
  onFilePicked?: (file: ImportedFile) => void;
  onPhotoTaken?: (photoUri: string, base64?: string) => void;
  /** 🆕 Appelé quand un enregistrement audio est terminé */
  onAudioRecorded?: (uri: string, durationMs: number) => void;
  disabled?: boolean;
  /** 🆕 Désactive complètement le micro (utile pendant un quiz) */
  micDisabled?: boolean;
  placeholder?: string;
  /** 🆕 Texte à pré-remplir (deep link, action externe) */
  prefillText?: string;
  /** 🆕 Callback appelé quand le pré-remplissage a été consommé */
  onPrefillConsumed?: () => void;
  /** 🆕 Clé de reset : quand elle change, le champ est vidé */
  resetKey?: string | number;
};

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function InputBar({
  onSend,
  onFilePicked,
  onPhotoTaken,
  onAudioRecorded,
  disabled = false,
  micDisabled = false,
  placeholder = 'Écris un message...',
  prefillText,
  onPrefillConsumed,
  resetKey,
}: Props) {
  const [text, setText] = useState('');
  const [fileImporterVisible, setFileImporterVisible] = useState(false);

  const { isListening, error, start, stop, cancel } = useSpeechRecognition({
    onResult: (transcript) => {
      if (micDisabled) return;
      setText(transcript);
    },
    disabled: micDisabled,
  });

  // 🆕 Enregistreur audio (5 min max, .m4a)
  const audio = useAudioRecorder({
    disabled: disabled || micDisabled,
    onRecorded: (uri, durationMs) => {
      onAudioRecorded?.(uri, durationMs);
    },
  });

  // Reset du champ quand resetKey change
  useEffect(() => {
    if (resetKey === undefined) return;
    setText('');
  }, [resetKey]);

  // Deep link : applique le texte pré-rempli
  useEffect(() => {
    if (prefillText && prefillText.trim().length > 0) {
      setText(prefillText);
      onPrefillConsumed?.();
    }
  }, [prefillText]);

  // Si micDisabled devient true, on arrête immédiatement le micro
  useEffect(() => {
    if (micDisabled && isListening) {
      try {
        stop();
      } catch {}
      setText('');
    }
  }, [micDisabled, isListening]);

  // Si disabled devient true pendant un enregistrement, on annule
  useEffect(() => {
    if (disabled && audio.isRecording) {
      audio.cancel();
    }
  }, [disabled, audio.isRecording]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleMicPress = async () => {
    if (isListening || micDisabled) return;

    try {
      await start();
    } catch (e) {
      Alert.alert(
        'Micro non disponible',
        'La reconnaissance vocale nécessite un Development Build.',
      );
    }
  };

  const handleValidate = () => {
    stop();
    setTimeout(() => handleSend(), 100);
  };

  const handleCancel = () => {
    cancel();
    setText('');
  };

  const handleFileImported = (file: ImportedFile) => {
    if (onFilePicked) {
      onFilePicked(file);
    }
  };

  const handlePhotoPress = async () => {
    if (disabled) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission refusée',
          'Autorise la caméra dans les paramètres de ton téléphone.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      if (onPhotoTaken) {
        onPhotoTaken(asset.uri, asset.base64 || undefined);
      }
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'ouvrir la caméra.");
    }
  };

  // 🆕 Enregistrement audio
  const handleAudioPress = async () => {
    if (disabled || micDisabled) return;
    if (audio.isRecording) return;
    await audio.start();
  };

  const handleAudioValidate = () => {
    audio.stop();
  };

  const handleAudioCancel = () => {
    audio.cancel();
  };

  if (error === 'permission-denied') {
    Alert.alert(
      'Permission refusée',
      'Autorise le micro dans les paramètres de ton téléphone.',
    );
  }

  // 🆕 Barre d'enregistrement audio (remplace toute la grid pendant l'enregistrement)
  if (audio.isRecording) {
    return (
      <View style={styles.container}>
        <View style={styles.recordingBanner}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingTime}>
            {formatDuration(audio.elapsedMs)} / {formatDuration(audio.maxDurationMs)}
          </Text>
          <Text style={styles.recordingHint}>Enregistrement…</Text>
        </View>

        <View style={styles.grid}>
          <TouchableOpacity style={styles.gridButtonRed} onPress={handleAudioCancel}>
            <Ionicons name="close" size={22} color={Colors.light.background} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.gridButtonGreen} onPress={handleAudioValidate}>
            <Ionicons name="checkmark" size={22} color={Colors.light.background} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={isListening ? 'Je t\'écoute...' : placeholder}
          placeholderTextColor={Colors.light.textSecondary}
          multiline
          editable={!disabled && !isListening}
          onSubmitEditing={handleSend}
        />
      </View>

      {isListening ? (
        <View style={styles.grid}>
          <TouchableOpacity style={styles.gridButtonRed} onPress={handleCancel}>
            <Ionicons name="close" size={22} color={Colors.light.background} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.gridButtonGreen} onPress={handleValidate}>
            <Ionicons name="checkmark" size={22} color={Colors.light.background} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.grid}>
          <TouchableOpacity
            style={[styles.gridButton, disabled && styles.buttonDisabled]}
            onPress={handlePhotoPress}
            disabled={disabled}
          >
            <Ionicons name="camera" size={20} color={Colors.light.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridButton, disabled && styles.buttonDisabled]}
            onPress={() => setFileImporterVisible(true)}
            disabled={disabled}
          >
            <Ionicons name="attach" size={20} color={Colors.light.primary} />
          </TouchableOpacity>

          {/* 🎤 Reconnaissance vocale (texte) */}
          <TouchableOpacity
            style={[
              styles.gridButton,
              (disabled || micDisabled) && styles.buttonDisabled,
            ]}
            onPress={handleMicPress}
            disabled={disabled || micDisabled}
          >
            <Ionicons
              name="mic"
              size={20}
              color={micDisabled ? Colors.light.textSecondary : Colors.light.primary}
            />
          </TouchableOpacity>

          {/* 🎙️ Enregistrement audio (5 min max, .m4a) */}
          <TouchableOpacity
            style={[
              styles.gridButton,
              (disabled || micDisabled) && styles.buttonDisabled,
            ]}
            onPress={handleAudioPress}
            disabled={disabled || micDisabled}
          >
            <Ionicons
              name="radio-outline"
              size={20}
              color={micDisabled ? Colors.light.textSecondary : Colors.light.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.gridButton,
              styles.sendButton,
              (!text.trim() || disabled) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!text.trim() || disabled}
          >
            <Ionicons name="send" size={20} color={Colors.light.background} />
          </TouchableOpacity>
        </View>
      )}

      <FileImporter
        visible={fileImporterVisible}
        onClose={() => setFileImporterVisible(false)}
        onFilePicked={handleFileImported}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: Spacing.two,
  },
  inputWrapper: {
    flex: 1,
  },
  input: {
    minHeight: 90,
    maxHeight: 150,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: Spacing.two,
    fontSize: 15,
    color: Colors.light.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 96,
    gap: Spacing.two,
  },
  gridButton: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridButtonRed: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    backgroundColor: Colors.light.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridButtonGreen: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    backgroundColor: Colors.light.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    backgroundColor: Colors.light.primary,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.light.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // 🆕 Barre d'enregistrement
  recordingBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.light.error,
  },
  recordingTime: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  recordingHint: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginLeft: 'auto',
  },
});