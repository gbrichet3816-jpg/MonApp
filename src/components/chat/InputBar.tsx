import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export default function InputBar({ onSend, disabled = false, placeholder = 'Écris un message...' }: Props) {
  const [text, setText] = useState('');

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
        "La reconnaissance vocale nécessite un Development Build. Elle ne fonctionne pas dans Expo Go.",
      );
    }
  };

  const handleValidate = () => {
    stop();
    // Le texte est déjà dans le champ, il suffit d'envoyer
    setTimeout(() => handleSend(), 100);
  };

  const handleCancel = () => {
    cancel();
    setText('');
  };

  if (error === 'permission-denied') {
    Alert.alert(
      'Permission refusée',
      "Autorise le micro dans les paramètres de ton téléphone pour utiliser cette fonctionnalité.",
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
            style={[styles.micButton, disabled && styles.micButtonDisabled]}
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
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundElement,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonDisabled: {
    opacity: 0.5,
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