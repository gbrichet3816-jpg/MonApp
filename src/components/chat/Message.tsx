import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { speakText, speakTextSlow, stopSpeaking } from '@/config/speech';
import { Colors, Spacing } from '@/constants/theme';

type Props = {
  text: string;
  isUser: boolean;
  autoSpeak?: boolean;
  isDictation?: boolean;
};

export default function Message({ text, isUser, autoSpeak = false, isDictation = false }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  // 🆕 Lecture automatique pour les dictées
  useEffect(() => {
    if (isDictation && autoSpeak && !isUser) {
      // Petite pause puis lecture lente
      const timer = setTimeout(() => {
        setIsPlaying(true);
        speakTextSlow(text, () => {
          setIsPlaying(false);
        });
      }, 500);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [isDictation, autoSpeak, isUser, text]);

  const handleSpeak = () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    if (isDictation) {
      // Pour une dictée, lecture LENTE
      speakTextSlow(text, () => {
        setIsPlaying(false);
      });
    } else {
      speakText(text, () => {
        setIsPlaying(false);
      });
    }
  };

  // 🆕 Affichage spécial pour les dictées non révélées
  if (isDictation && !isRevealed) {
    return (
      <View style={[styles.container, styles.agentContainer]}>
        <View style={[styles.bubble, styles.agentBubble, styles.dictationBubble]}>
          <View style={styles.dictationHeader}>
            <Ionicons name="mic-outline" size={16} color={Colors.light.primary} />
            <Text style={styles.dictationLabel}>Dictée en cours</Text>
          </View>
          <Text style={styles.dictationHint}>
            🔒 Écoute bien et écris la phrase sur ton cahier. Le texte est caché.
          </Text>
          <View style={styles.dictationActions}>
            <TouchableOpacity style={styles.dictationButton} onPress={handleSpeak}>
              <Ionicons
                name={isPlaying ? 'stop-circle-outline' : 'volume-medium-outline'}
                size={18}
                color={Colors.light.background}
              />
              <Text style={styles.dictationButtonText}>
                {isPlaying ? 'Arrêter' : 'Réécouter'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dictationButton, styles.dictationButtonOutline]}
              onPress={() => setIsRevealed(true)}
            >
              <Ionicons name="eye-outline" size={18} color={Colors.light.primary} />
              <Text style={[styles.dictationButtonText, styles.dictationButtonTextOutline]}>
                Révéler
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Message normal (ou dictée révélée)
  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.agentContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}>
        {isDictation && (
          <View style={styles.dictationHeader}>
            <Ionicons name="mic-outline" size={16} color={Colors.light.primary} />
            <Text style={styles.dictationLabel}>Dictée</Text>
          </View>
        )}
        <Text style={[styles.text, isUser ? styles.userText : styles.agentText]}>{text}</Text>

        {!isUser && (
          <TouchableOpacity style={styles.speakButton} onPress={handleSpeak}>
            <Ionicons
              name={isPlaying ? 'stop-circle-outline' : 'volume-medium-outline'}
              size={20}
              color={Colors.light.primary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  agentContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  userBubble: {
    backgroundColor: Colors.light.primary,
    borderBottomRightRadius: Spacing.one,
  },
  agentBubble: {
    backgroundColor: Colors.light.backgroundElement,
    borderBottomLeftRadius: Spacing.one,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: Colors.light.background,
  },
  agentText: {
    color: Colors.light.text,
  },
  speakButton: {
    marginTop: Spacing.two,
    alignSelf: 'flex-start',
  },
  // 🆕 Styles pour la dictée
  dictationBubble: {
    backgroundColor: '#FFF8E1',
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderStyle: 'dashed',
  },
  dictationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
    gap: Spacing.one,
  },
  dictationLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dictationHint: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: Spacing.three,
    lineHeight: 20,
  },
  dictationActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  dictationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: Colors.light.primary,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  dictationButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
  },
  dictationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.background,
  },
  dictationButtonTextOutline: {
    color: Colors.light.primary,
  },
});