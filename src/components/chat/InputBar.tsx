import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import FileImporter, { ImportedFile } from './FileImporter';

type Props = {
  onSend: (text: string) => void;
  onFilePicked?: (file: ImportedFile) => void;
  disabled?: boolean;
  placeholder?: string;
};

export default function InputBar({
  onSend,
  onFilePicked,
  disabled = false,
  placeholder = 'Écris un message...',
}: Props) {
  const [text, setText] = useState('');
  const [fileImporterVisible, setFileImporterVisible] = useState(false);

  const { isListening, error, start, stop, cancel } = useSpeechRecognition({
    onResult: (transcript) => {
      setText(transcript);
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleMicPress = async () => {
    if (isListening) return;

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

  if (error === 'permission-denied') {
    Alert.alert(
      'Permission refusée',
      'Autorise le micro dans les paramètres de ton téléphone.',
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={Colors.light.textSecondary}
        multiline
        editable={!disabled && !isListening}
        onSubmitEditing={handleSend}
      />

      {isListening ? (
        <>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Ionicons name="close" size={20} color={Colors.light.background} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.validateButton} onPress={handleValidate}>
            <Ionicons name="checkmark" size={22} color={Colors.light.background} />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.attachButton, disabled && styles.buttonDisabled]}
            onPress={() => setFileImporterVisible(true)}
            disabled={disabled}
          >
            <Ionicons name="attach" size={20} color={Colors.light.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.micButton, disabled && styles.buttonDisabled]}
            onPress={handleMicPress}
            disabled={disabled}
          >
            <Ionicons name="mic" size={20} color={Colors.light.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendButton, (!text.trim() || disabled) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || disabled}
          >
            <Ionicons name="send" size={20} color={Colors.light.background} />
          </TouchableOpacity>
        </>
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
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: Spacing.four,
    fontSize: 15,
    color: Colors.light.text,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundElement,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundElement,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.light.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  validateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
});