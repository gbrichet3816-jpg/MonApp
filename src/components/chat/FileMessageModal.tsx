import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { ImportedFile } from './FileImporter';

type Props = {
  visible: boolean;
  file: ImportedFile | null;
  onSend: (message: string, saveToLibrary: boolean) => void;
  onSendWithoutMessage: (saveToLibrary: boolean) => void;
  onCancel: () => void;
};

export default function FileMessageModal({
  visible,
  file,
  onSend,
  onSendWithoutMessage,
  onCancel,
}: Props) {
  const [message, setMessage] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(false);

  const { isListening, start, stop, cancel } = useSpeechRecognition({
    onResult: (transcript) => {
      setMessage(transcript);
    },
  });

  if (!file) return null;

  const isImage = file.type === 'image';

  const handleSend = () => {
    if (isListening) stop();
    onSend(message.trim(), saveToLibrary);
    setMessage('');
    setSaveToLibrary(false);
  };

  const handleSendWithout = () => {
    if (isListening) cancel();
    onSendWithoutMessage(saveToLibrary);
    setMessage('');
    setSaveToLibrary(false);
  };

  const handleCancel = () => {
    if (isListening) cancel();
    onCancel();
    setMessage('');
    setSaveToLibrary(false);
  };

  const handleMicPress = async () => {
    if (isListening) {
      stop();
      return;
    }
    try {
      await start();
    } catch (e) {
      // Silencieux
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.panel}>
          <Text style={styles.title}>
            {isImage ? '🖼️ Image prête' : '📄 Fichier prêt'}
          </Text>

          {isImage ? (
            <Image source={{ uri: file.uri }} style={styles.preview} resizeMode="contain" />
          ) : (
            <View style={styles.filePlaceholder}>
              <Ionicons name="document" size={48} color={Colors.light.primary} />
              <Text style={styles.fileName} numberOfLines={2}>
                {file.fileName}
              </Text>
              {!isImage && (
                <Text style={styles.fileHint}>
                  (Pas d'analyse possible pour ce fichier)
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setSaveToLibrary(!saveToLibrary)}
          >
            <Ionicons
              name={saveToLibrary ? 'checkbox' : 'square-outline'}
              size={24}
              color={saveToLibrary ? Colors.light.primary : Colors.light.textSecondary}
            />
            <Text style={styles.checkboxLabel}>
              Enregistrer dans ma bibliothèque
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>
            {isImage
              ? 'Ajouter un message (optionnel)'
              : 'Décris ce fichier pour l\'agent (optionnel)'}
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder={isListening ? 'Je t\'écoute...' : 'Ex: Analyse cette image'}
              placeholderTextColor={Colors.light.textSecondary}
              multiline
              editable={!isListening}
            />
            <TouchableOpacity
              style={[styles.micButton, isListening && styles.micButtonActive]}
              onPress={handleMicPress}
            >
              <Ionicons
                name={isListening ? 'stop' : 'mic'}
                size={22}
                color={Colors.light.background}
              />
            </TouchableOpacity>
          </View>

          {isListening && (
            <Text style={styles.listeningHint}>
              🎤 Parle, ton message s'écrit tout seul
            </Text>
          )}

          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Ionicons name="send" size={20} color={Colors.light.background} />
            <Text style={styles.sendText}>Envoyer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sendWithoutButton}
            onPress={handleSendWithout}
          >
            <Text style={styles.sendWithoutText}>Envoyer sans message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  preview: {
    width: '100%',
    height: 150,
    borderRadius: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
    marginBottom: Spacing.three,
  },
  filePlaceholder: {
    width: '100%',
    minHeight: 120,
    borderRadius: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  fileHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },
  checkboxLabel: {
    fontSize: 15,
    color: Colors.light.text,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: Spacing.two,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: Spacing.two,
    fontSize: 15,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonActive: {
    backgroundColor: Colors.light.error,
  },
  listeningHint: {
    fontSize: 12,
    color: Colors.light.primary,
    fontStyle: 'italic',
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  sendButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  sendText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
  },
  sendWithoutButton: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  sendWithoutText: {
    fontSize: 15,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
});