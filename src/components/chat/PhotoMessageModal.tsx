import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

export type PhotoAction = 'agent' | 'agent+save' | 'save';

type Props = {
  visible: boolean;
  photoUri: string;
  onSend: (message: string, action: PhotoAction) => void;
  onCancel: () => void;
};

export default function PhotoMessageModal({
  visible,
  photoUri,
  onSend,
  onCancel,
}: Props) {
  const [message, setMessage] = useState('');
  const [action, setAction] = useState<PhotoAction>('agent');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 80);

  // 🆕 Détection hauteur clavier
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const effectiveBottom = keyboardHeight > 0 ? keyboardHeight + 16 : safeBottom;

  const { isListening, start, stop, cancel } = useSpeechRecognition({
    onResult: (transcript) => {
      setMessage(transcript);
    },
  });

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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.flexEnd}>
            <View style={[styles.panel, { paddingBottom: effectiveBottom }]}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.topBar}>
                  <TouchableOpacity style={styles.topBarClose} onPress={handleCancel}>
                    <Ionicons name="close" size={28} color={Colors.light.text} />
                  </TouchableOpacity>
                  <Text style={styles.topBarTitle}>📷 Photo prête</Text>
                  <View style={{ width: 28 }} />
                </View>

                <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="contain" />

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
                    <Text style={styles.label}>Ajouter un message (optionnel)</Text>

                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.input}
                        value={message}
                        onChangeText={setMessage}
                        placeholder={isListening ? 'Je t\'écoute...' : 'Ex: Analyse cette photo'}
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
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
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
  flexEnd: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    maxHeight: '95%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  topBarClose: {
    padding: Spacing.one,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    flex: 1,
  },
  preview: {
    width: '100%',
    height: 150,
    borderRadius: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
    marginBottom: Spacing.three,
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
});