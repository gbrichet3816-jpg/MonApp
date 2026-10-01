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

export type FileAction = 'agent' | 'agent+save' | 'save';

type Props = {
  visible: boolean;
  file: ImportedFile | null;
  onSend: (message: string, action: FileAction) => void;
  onCancel: () => void;
};

export default function FileMessageModal({
  visible,
  file,
  onSend,
  onCancel,
}: Props) {
  const [message, setMessage] = useState('');
  const [action, setAction] = useState<FileAction>('agent');

  const { isListening, start, stop, cancel } = useSpeechRecognition({
    onResult: (transcript) => {
      setMessage(transcript);
    },
  });

  if (!file) return null;

  const isImage = file.type === 'image';

  const toggleAgentSave = () => {
    setAction(action === 'agent+save' ? 'agent' : 'agent+save');
  };

  const toggleSaveOnly = () => {
    setAction(action === 'save' ? 'agent' : 'save');
  };

  const handleSend = () => {
    if (isListening) stop();
    onSend(message.trim(), action);
    setMessage('');
    setAction('agent');
  };

  const handleCancel = () => {
    if (isListening) cancel();
    onCancel();
    setMessage('');
    setAction('agent');
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

  const showInput = action === 'agent' || action === 'agent+save';

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
            </View>
          )}

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={toggleAgentSave}
          >
            <Ionicons
              name={action === 'agent+save' ? 'checkbox' : 'square-outline'}
              size={24}
              color={action === 'agent+save' ? Colors.light.primary : Colors.light.textSecondary}
            />
            <Text style={styles.checkboxLabel}>
              Envoyer à l'agent + Enregistrer dans la bibliothèque
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={toggleSaveOnly}
          >
            <Ionicons
              name={action === 'save' ? 'checkbox' : 'square-outline'}
              size={24}
              color={action === 'save' ? Colors.light.primary : Colors.light.textSecondary}
            />
            <Text style={styles.checkboxLabel}>
              Enregistrer seulement (sans l'agent)
            </Text>
          </TouchableOpacity>

          <Text style={styles.defaultHint}>
            {action === 'agent' && '(Rien de coché = envoi à l\'agent)'}
            {action === 'agent+save' && '(Envoi + sauvegarde)'}
            {action === 'save' && '(Sauvegarde uniquement)'}
          </Text>

          {showInput && (
            <>
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
            </>
          )}

          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.light.background} />
            <Text style={styles.sendText}>Valider</Text>
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  checkboxLabel: {
    fontSize: 15,
    color: Colors.light.text,
    flex: 1,
  },
  defaultHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: Spacing.two,
    marginTop: Spacing.two,
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
  cancelButton: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  cancelText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
});