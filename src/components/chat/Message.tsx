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
  const [currentIndex, setCurrentIndex] = useState(0);

  // 🆕 Découper le texte en phrases (par \n ou séparateur explicite)
  const sentences = isDictation
    ? text
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [text];

  const currentSentence = sentences[currentIndex] || '';
  const totalSentences = sentences.length;

  // 🆕 Lecture automatique de la phrase en cours
  useEffect(() => {
    if (isDictation && autoSpeak && !isUser && currentSentence) {
      const timer = setTimeout(() => {
        setIsPlaying(true);
        speakTextSlow(currentSentence, () => {
          setIsPlaying(false);
        });
      }, 500);
      return () => {
        clearTimeout(timer);
        stopSpeaking();
      };
    }
  }, [isDictation, autoSpeak, isUser, currentSentence]);

  const handleSpeak = () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    if (isDictation) {
      speakTextSlow(currentSentence, () => {
        setIsPlaying(false);
      });
    } else {
      speakText(text, () => {
        setIsPlaying(false);
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < totalSentences - 1) {
      stopSpeaking();
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      stopSpeaking();
      setCurrentIndex(currentIndex - 1);
    }
  };

  // ============================================================
  // AFFICHAGE DICTÉE
  // ============================================================
  if (isDictation) {
    const isLast = currentIndex === totalSentences - 1;
    const isFirst = currentIndex === 0;

    return (
      <View style={[styles.container, styles.agentContainer]}>
        <View style={[styles.bubble, styles.agentBubble, styles.dictationBubble]}>
          {/* Header avec progression */}
          <View style={styles.dictationHeader}>
            <Ionicons name="mic-outline" size={16} color={Colors.light.primary} />
            <Text style={styles.dictationLabel}>Dictée</Text>
            {totalSentences > 1 && (
              <Text style={styles.dictationProgress}>
                Phrase {currentIndex + 1}/{totalSentences}
              </Text>
            )}
          </View>

          {!isRevealed ? (
            <>
              <Text style={styles.dictationHint}>
                🔒 Écoute bien la phrase, puis écris-la sur ton cahier.
              </Text>

              {/* Boutons principaux */}
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

              {/* Navigation Précédent/Suivant */}
              {totalSentences > 1 && (
                <View style={styles.dictationNav}>
                  <TouchableOpacity
                    style={[
                      styles.dictationNavButton,
                      isFirst && styles.dictationNavButtonDisabled,
                    ]}
                    onPress={handlePrevious}
                    disabled={isFirst}
                  >
                    <Ionicons
                      name="arrow-back"
                      size={18}
                      color={isFirst ? Colors.light.textSecondary : Colors.light.primary}
                    />
                    <Text
                      style={[
                        styles.dictationNavText,
                        isFirst && styles.dictationNavTextDisabled,
                      ]}
                    >
                      Précédent
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.dictationNavButton,
                      isLast && styles.dictationNavButtonDisabled,
                    ]}
                    onPress={handleNext}
                    disabled={isLast}
                  >
                    <Text
                      style={[
                        styles.dictationNavText,
                        isLast && styles.dictationNavTextDisabled,
                      ]}
                    >
                      {isLast ? 'Terminer' : 'Suivant'}
                    </Text>
                    <Ionicons
                      name={isLast ? 'checkmark' : 'arrow-forward'}
                      size={18}
                      color={isLast ? Colors.light.textSecondary : Colors.light.primary}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {isLast && totalSentences === 1 && (
                <Text style={styles.dictationEndHint}>
                  ✅ Quand tu as fini, montre-moi ton cahier en photo 📷
                </Text>
              )}
            </>
          ) : (
            <>
              {/* Mode révélé : on affiche toutes les phrases */}
              <Text style={styles.dictationRevealedTitle}>📖 Texte révélé</Text>
              {sentences.map((s, i) => (
                <Text
                  key={i}
                  style={[
                    styles.dictationRevealedText,
                    i === currentIndex && styles.dictationRevealedTextActive,
                  ]}
                >
                  {i + 1}. {s}
                </Text>
              ))}
              <TouchableOpacity
                style={[styles.dictationButton, styles.dictationButtonOutline, { marginTop: Spacing.three }]}
                onPress={() => setIsRevealed(false)}
              >
                <Ionicons name="eye-off-outline" size={18} color={Colors.light.primary} />
                <Text style={[styles.dictationButtonText, styles.dictationButtonTextOutline]}>
                  Recacher
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  // ============================================================
  // AFFICHAGE MESSAGE NORMAL
  // ============================================================
  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.agentContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}>
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
    maxWidth: '85%',
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

  // 🆕 Dictée
  dictationBubble: {
    backgroundColor: '#FFF8E1',
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderStyle: 'dashed',
    minWidth: 260,
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
  dictationProgress: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 'auto',
    fontWeight: '600',
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
  dictationNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  dictationNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  dictationNavButtonDisabled: {
    opacity: 0.4,
  },
  dictationNavText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  dictationNavTextDisabled: {
    color: Colors.light.textSecondary,
  },
  dictationEndHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: Spacing.three,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  dictationRevealedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.primary,
    marginBottom: Spacing.two,
  },
  dictationRevealedText: {
    fontSize: 15,
    color: Colors.light.text,
    lineHeight: 22,
    marginBottom: Spacing.one,
  },
  dictationRevealedTextActive: {
    fontWeight: '700',
    color: Colors.light.primary,
  },
});