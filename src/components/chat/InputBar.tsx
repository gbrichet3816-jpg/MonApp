import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import FileImporter, { ImportedFile } from './FileImporter';

type Props = {
  onSend: (text: string) => void;
  onFilePicked?: (file: ImportedFile) => void;
  onPhotoTaken?: (photoUri: string, base64?: string) => void;
  disabled?: boolean;
  /** 🆕 Désactive complètement le micro (utile pendant un quiz) */
  micDisabled?: boolean;
  placeholder?: string;
};

export default function InputBar({
  onSend,
  onFilePicked,
  onPhotoTaken,
  disabled = false,
  micDisabled = false,
  placeholder = 'Écris un message...',
}: Props) {
  const [text, setText] = useState('');
  const [fileImporterVisible, setFileImporterVisible] = useState(false);

  const { isListening, error, start, stop, cancel } = useSpeechRecognition({
    onResult: (transcript) => {
      // 🆕 Si le micro est désactivé, on ignore le résultat
      if (micDisabled) return;
      setText(transcript);
    },
  });

  // 🆕 Bug #20 : si micDisabled devient true, on arrête immédiatement le micro
  useEffect(() => {
    if (micDisabled && isListening) {
      try {
        stop();
      } catch {}
      setText('');   // On efface le texte dicté en cours
    }
  }, [micDisabled, isListening]);

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

  if (error === 'permission-denied') {
    Alert.alert(
      'Permission refusée',
      'Autorise le micro dans les paramètres de ton téléphone.',
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
});