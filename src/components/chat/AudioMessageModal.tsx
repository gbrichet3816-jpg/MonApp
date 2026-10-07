import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import {
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

export type AudioAction = 'agent' | 'agent+save' | 'save';

type Props = {
  visible: boolean;
  audioUri: string | null;
  audioDurationMs: number;
  onSend: (message: string, action: AudioAction) => void;
  onCancel: () => void;
};

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioMessageModal({
  visible,
  audioUri,
  audioDurationMs,
  onSend,
  onCancel,
}: Props) {
  const [message, setMessage] = useState('');
  const [action, setAction] = useState<AudioAction>('agent');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 80);

  // 🎧 Lecteur audio
  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);
  const status = useAudioPlayerStatus(player);

  // Détection clavier
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

  // Stopper la lecture quand on ferme le modal
  useEffect(() => {
    if (!visible && status.playing) {
      try {
        player.pause();
      } catch {}
    }
  }, [visible]);

  const { isListening, start, stop, cancel } = useSpeechRecognition({
    onResult: (transcript) => {
      setMessage(transcript);
    },
  });

  if (!audioUri) return null;

  const toggleAgentSave = () => {
    setAction(action === 'agent+save' ? 'agent' : 'agent+save');
  };

  const toggleSaveOnly = () => {
    setAction(action === 'save' ? 'agent' : 'save');
  };

  const handleTogglePlay = () => {
    try {
      if (status.playing) {
        player.pause();
      } else {
        // Repartir du début si terminé
        if (status.didJustFinish || status.currentTime >= (status.duration || 0)) {
          player.seekTo(0);
        }
        player.play();
      }
    } catch (e) {
      console.warn('[Audio] Play/pause error:', e);
    }
  };

  const handleSend = () => {
    if (isListening) stop();
    try {
      player.pause();
    } catch {}
    onSend(message.trim(), action);
    setMessage('');
    setAction('agent');
  };

  const handleCancel = () => {
    if (isListening) cancel();
    try {
      player.pause();
    } catch {}
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
    } catch {}
  };

  const showInput = action === 'agent' || action === 'agent+save';

  const currentSec = Math.floor(status.currentTime || 0);
  const totalSec = Math.floor(status.duration || audioDurationMs / 1000);
  const progress = totalSec > 0 ? Math.min(1, currentSec / totalSec) : 0;

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
                {/* Barre du haut */}
                <View style={styles.topBar}>
                  <TouchableOpacity style={styles.topBarClose} onPress={handleCancel}>
                    <Ionicons name="close" size={28} color={Colors.light.text} />
                  </TouchableOpacity>
                  <Text style={styles.topBarTitle}>🎙️ Audio prêt</Text>
                  <View style={{ width: 28 }} />
                </View>

                {/* 🎧 Aperçu audio */}
                <View style={styles.audioPreview}>
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={handleTogglePlay}
                  >
                    <Ionicons
                      name={status.playing ? 'pause' : 'play'}
                      size={26}
                      color={Colors.light.background}
                    />
                  </TouchableOpacity>

                  <View style={styles.audioInfo}>
                    <Text style={styles.audioTitle} numberOfLines={1}>
                      Enregistrement vocal
                    </Text>
                    <Text style={styles.audioDuration}>
                      {formatDuration((status.currentTime || 0) * 1000)} / {formatDuration(audioDurationMs)}
                    </Text>
                  </View>

                  <View style={styles.audioProgressBar}>
                    <View
                      style={[styles.audioProgressFill, { width: `${progress * 100}%` }]}
                    />
                  </View>
                </View>

                {/* Cases à cocher (identiques au FileMessageModal) */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={toggleAgentSave}
                >
                  <Ionicons
                    name={action === 'agent+save' ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={
                      action === 'agent+save'
                        ? Colors.light.primary
                        : Colors.light.textSecondary
                    }
                  />
                  <Text style={styles.checkboxLabel}>
                    Envoyer à l'agent + Enregistrer dans la bibliothèque
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.checkboxRow} onPress={toggleSaveOnly}>
                  <Ionicons
                    name={action === 'save' ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={
                      action === 'save'
                        ? Colors.light.primary
                        : Colors.light.textSecondary
                    }
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
                      Ajouter un message (optionnel)
                    </Text>

                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.input}
                        value={message}
                        onChangeText={setMessage}
                        placeholder={isListening ? 'Je t\'écoute...' : 'Ex: Voici mes révisions'}
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
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={Colors.light.background}
                  />
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
  flexEnd: { flex: 1, justifyContent: 'flex-end' },
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
  topBarClose: { padding: Spacing.one },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    flex: 1,
  },
  // 🎧 Aperçu audio
  audioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.three,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioInfo: { flex: 1 },
  audioTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  audioDuration: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  audioProgressBar: {
    position: 'absolute',
    bottom: 0,
    left: Spacing.three,
    right: Spacing.three,
    height: 3,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioProgressFill: {
    height: 3,
    backgroundColor: Colors.light.primary,
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
  micButtonActive: { backgroundColor: Colors.light.error },
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