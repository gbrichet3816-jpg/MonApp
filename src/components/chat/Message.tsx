import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { judgeAnswer } from '@/config/api';
import { speakText, speakTextSlow, stopSpeaking } from '@/config/speech';
import { Colors, Spacing } from '@/constants/theme';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { answersMatchLocal, looksAlmostCorrect } from '@/utils/answerMatch';

export type QuizQuestion = {
  question: string;
  answer: string;
};

type Props = {
  text: string;
  isUser: boolean;
  autoSpeak?: boolean;
  isDictation?: boolean;
  isQuiz?: boolean;
  quizTitle?: string;
  quizQuestions?: QuizQuestion[];
  onQuizAnswer?: (questionIndex: number, userAnswer: string) => void;
};

// Nettoyage des balises internes DeepSeek (<||DSML||> etc.)
function cleanDsmlTags(text: string): string {
  if (!text) return '';
  return text
    .replace(/<+\|+\|?\s*DSML\s*\|?\|+>+/gi, '')
    .replace(/<\/+\|+\|?\s*DSML\s*\|?\|+>+/gi, '')
    .replace(/<\|[^|>]+\|>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export default function Message({
  text,
  isUser,
  autoSpeak = false,
  isDictation = false,
  isQuiz = false,
  quizTitle,
  quizQuestions,
  onQuizAnswer,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [userAnswer, setUserAnswer] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    almost: boolean;
    expected: string;
    explanation: string | null;
  } | null>(null);
  const [showMicMode, setShowMicMode] = useState(false);

  const [correctCount, setCorrectCount] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const transcriptRef = useRef('');
  const isListeningRef = useRef(false);
  const inputRef = useRef<TextInput>(null);

  const { isListening, error, start, stop, cancel } = useSpeechRecognition({
    onResult: (transcript) => {
      if (transcript && transcript.trim().length > 0) {
        transcriptRef.current = transcript;
      }
    },
  });

  useEffect(() => {
    if (isListening) {
      isListeningRef.current = true;
    } else if (isListeningRef.current) {
      isListeningRef.current = false;
      if (transcriptRef.current.trim()) {
        setUserAnswer(transcriptRef.current);
      }
    }
  }, [isListening]);

  const sentences = isDictation
    ? text
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [text];

  const currentSentence = sentences[currentIndex] || '';
  const totalSentences = sentences.length;

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

  useEffect(() => {
    if (isQuiz && quizQuestions && quizQuestions[currentIndex] && !quizFinished) {
      const timer = setTimeout(() => {
        setIsPlaying(true);
        speakText(quizQuestions[currentIndex].question, () => {
          setIsPlaying(false);
        });
      }, 500);
      return () => {
        clearTimeout(timer);
        stopSpeaking();
      };
    }
  }, [isQuiz, currentIndex, quizQuestions, quizFinished]);

  useEffect(() => {
    if (error === 'permission-denied') {
      Alert.alert(
        'Permission refusée',
        'Autorise le micro dans les paramètres de ton téléphone.'
      );
      setShowMicMode(false);
    }
  }, [error]);

  const handleSpeak = async () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    if (isDictation) {
      speakTextSlow(currentSentence, () => setIsPlaying(false));
    } else if (isQuiz && quizQuestions && quizQuestions[currentIndex]) {
      speakText(quizQuestions[currentIndex].question, () => setIsPlaying(false));
    } else {
      speakText(text, () => setIsPlaying(false));
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

  const handleMicStart = async () => {
    try {
      transcriptRef.current = '';
      setUserAnswer('');
      setShowMicMode(true);
      await start();
    } catch (e) {
      setShowMicMode(false);
      Alert.alert(
        'Micro non disponible',
        'La reconnaissance vocale nécessite un Development Build.'
      );
    }
  };

  const handleMicCancel = () => {
    try {
      cancel();
    } catch {}
    transcriptRef.current = '';
    setShowMicMode(false);
    setUserAnswer('');
  };

  // ============================================================
  // MODE QUIZ
  // ============================================================
  if (isQuiz && quizQuestions && quizQuestions.length > 0) {
    const currentQuestion = quizQuestions[currentIndex];
    const totalQuestions = quizQuestions.length;
    const isLast = currentIndex === totalQuestions - 1;

    /**
     * 🆕 Validation hybride :
     * 1. Comparaison locale tolérante → si OK : vert immédiat
     * 2. Sinon → appel IA → résultat (correct / almost / faux)
     */
    const validateCurrentAnswer = async (answer: string) => {
      if (!answer.trim() || isValidating) return;
      setIsValidating(true);

      // Étape 1 : comparaison locale
      const localMatch = answersMatchLocal(answer, currentQuestion.answer);
      if (localMatch) {
        setCorrectCount((prev) => prev + 1);
        setFeedback({
          correct: true,
          almost: false,
          expected: currentQuestion.answer,
          explanation: null,
        });
        onQuizAnswer?.(currentIndex, answer);
        setIsValidating(false);
        return;
      }

      // Étape 2 : appel IA (uniquement si ça vaut le coup)
      if (looksAlmostCorrect(answer, currentQuestion.answer)) {
        const result = await judgeAnswer({
          question: currentQuestion.question,
          expected: currentQuestion.answer,
          given: answer,
        });

        if (result.correct) {
          setCorrectCount((prev) => prev + 1);
          setFeedback({
            correct: true,
            almost: false,
            expected: currentQuestion.answer,
            explanation: null,
          });
        } else if (result.almost) {
          // Presque juste → compté juste par bienveillance (Q2 = A)
          setCorrectCount((prev) => prev + 1);
          setFeedback({
            correct: true,
            almost: true,
            expected: currentQuestion.answer,
            explanation: result.explanation,
          });
        } else {
          setFeedback({
            correct: false,
            almost: false,
            expected: currentQuestion.answer,
            explanation: result.explanation,
          });
        }
      } else {
        // Vraiment faux → pas besoin d'appeler l'IA
        setFeedback({
          correct: false,
          almost: false,
          expected: currentQuestion.answer,
          explanation: null,
        });
      }

      onQuizAnswer?.(currentIndex, answer);
      setIsValidating(false);
    };

    const handleValidate = () => validateCurrentAnswer(userAnswer);

    const handleMicSend = () => {
      try { stop(); } catch {}
      setShowMicMode(false);
      const finalAnswer = transcriptRef.current || userAnswer;
      if (finalAnswer.trim()) {
        setUserAnswer(finalAnswer);
        setTimeout(() => validateCurrentAnswer(finalAnswer), 50);
      }
    };

    const handleNextQuestion = () => {
      stopSpeaking();
      transcriptRef.current = '';
      setUserAnswer('');
      setFeedback(null);
      setShowMicMode(false);
      setCurrentIndex(currentIndex + 1);
    };

    const handleFinishQuiz = () => {
      stopSpeaking();
      setQuizFinished(true);
      onQuizAnswer?.(-1, `FIN:${correctCount}/${totalQuestions}`);
    };

    if (quizFinished) {
      return (
        <View style={[styles.container, styles.agentContainer]}>
          <View style={[styles.bubble, styles.agentBubble, styles.quizBubble, styles.quizFinishedBubble]}>
            <View style={styles.quizHeader}>
              <Ionicons name="trophy-outline" size={16} color="#2E7D32" />
              <Text style={styles.quizLabel}>{quizTitle || 'Quiz'}</Text>
              <View style={styles.quizFinishedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.light.background} />
                <Text style={styles.quizFinishedBadgeText}>Terminé</Text>
              </View>
            </View>
            <View style={styles.quizScoreContainer}>
              <Ionicons name="trophy" size={48} color="#FFB300" />
              <Text style={styles.quizScoreText}>{correctCount} / {totalQuestions}</Text>
              <Text style={styles.quizScoreLabel}>
                {correctCount === totalQuestions ? 'Score parfait ! 🎉'
                  : correctCount >= totalQuestions / 2 ? 'Bien joué ! 👏'
                  : 'Continue à t\'entraîner ! 💪'}
              </Text>
            </View>
            <Text style={styles.quizFinishedHint}>Regarde le chat pour la suite 👇</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.container, styles.agentContainer]}>
        <View style={[styles.bubble, styles.agentBubble, styles.quizBubble]}>
          <View style={styles.quizHeader}>
            <Ionicons name="help-circle-outline" size={16} color={Colors.light.primary} />
            <Text style={styles.quizLabel}>{quizTitle || 'Quiz'}</Text>
            <Text style={styles.quizProgress}>Question {currentIndex + 1}/{totalQuestions}</Text>
          </View>
          <View style={styles.quizQuestionRow}>
            <Text style={styles.quizQuestion}>{currentQuestion.question}</Text>
            <TouchableOpacity style={styles.quizSpeakButton} onPress={handleSpeak}>
              <Ionicons
                name={isPlaying ? 'stop-circle-outline' : 'volume-medium-outline'}
                size={20}
                color={Colors.light.primary}
              />
            </TouchableOpacity>
          </View>

          {feedback ? (
            <View style={styles.quizFeedbackContainer}>
              <View style={[
                styles.quizFeedbackBubble,
                feedback.correct && !feedback.almost ? styles.quizFeedbackCorrect
                  : feedback.correct && feedback.almost ? styles.quizFeedbackAlmost
                  : styles.quizFeedbackWrong
              ]}>
                <Ionicons
                  name={feedback.correct ? 'checkmark-circle' : 'close-circle'}
                  size={24}
                  color={feedback.correct && !feedback.almost ? '#2E7D32'
                    : feedback.correct && feedback.almost ? '#E65100'
                    : '#C62828'}
                />
                <Text style={[
                  styles.quizFeedbackText,
                  feedback.correct && !feedback.almost ? styles.quizFeedbackTextCorrect
                    : feedback.correct && feedback.almost ? styles.quizFeedbackTextAlmost
                    : styles.quizFeedbackTextWrong
                ]}>
                  {feedback.correct && !feedback.almost ? 'Bravo ! 🎉'
                    : feedback.correct && feedback.almost ? 'Presque ! ✅'
                    : 'Pas tout à fait…'}
                </Text>
              </View>
              {feedback.almost && (
                <Text style={styles.quizFeedbackAlmostHint}>
                  On comptait : <Text style={styles.quizFeedbackExpectedBold}>{feedback.expected}</Text>
                </Text>
              )}
              {!feedback.correct && (
                <Text style={styles.quizFeedbackExpected}>
                  La bonne réponse était : <Text style={styles.quizFeedbackExpectedBold}>{feedback.expected}</Text>
                </Text>
              )}
              {feedback.explanation && (
                <Text style={styles.quizFeedbackExplanation}>
                  💡 {feedback.explanation}
                </Text>
              )}
              {!isLast ? (
                <TouchableOpacity style={[styles.quizButton, styles.quizButtonPrimary]} onPress={handleNextQuestion}>
                  <Text style={styles.quizButtonText}>Question suivante</Text>
                  <Ionicons name="arrow-forward" size={18} color={Colors.light.background} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.quizButton, styles.quizButtonSuccess]} onPress={handleFinishQuiz}>
                  <Ionicons name="checkmark-done" size={18} color={Colors.light.background} />
                  <Text style={styles.quizButtonText}>Terminer le quiz</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : showMicMode ? (
            <View style={styles.quizMicContainer}>
              <View style={styles.quizMicRow}>
                <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={20} color={isListening ? '#C62828' : Colors.light.textSecondary} />
                <Text style={[styles.quizMicText, !isListening && styles.quizMicTextIdle]}>
                  {isListening ? 'Je t\'écoute…' : 'Enregistrement terminé'}
                </Text>
              </View>
              {userAnswer || transcriptRef.current ? (
                <Text style={styles.quizMicTranscript}>« {userAnswer || transcriptRef.current} »</Text>
              ) : (
                <Text style={styles.quizMicHint}>{isListening ? 'Parle maintenant' : 'Aucune parole détectée'}</Text>
              )}
              <View style={styles.quizMicActions}>
                <TouchableOpacity style={[styles.quizMicButton, styles.quizMicButtonCancel]} onPress={handleMicCancel}>
                  <Ionicons name="close" size={20} color={Colors.light.background} />
                  <Text style={styles.quizMicButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quizMicButton, styles.quizMicButtonValidate]}
                  onPress={handleMicSend}
                  disabled={!userAnswer.trim() && !transcriptRef.current.trim()}
                >
                  <Ionicons name="send" size={20} color={Colors.light.background} />
                  <Text style={styles.quizMicButtonText}>Envoyer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.quizInputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.quizInput}
                value={userAnswer}
                onChangeText={setUserAnswer}
                placeholder="Ta réponse…"
                placeholderTextColor={Colors.light.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isValidating}
                onSubmitEditing={handleValidate}
                returnKeyType="send"
              />
              <TouchableOpacity style={styles.quizMicIcon} onPress={handleMicStart} disabled={isValidating}>
                <Ionicons name="mic" size={22} color={Colors.light.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quizValidateButton, !userAnswer.trim() && styles.quizValidateButtonDisabled]}
                onPress={handleValidate}
                disabled={!userAnswer.trim() || isValidating}
              >
                {isValidating ? <ActivityIndicator size="small" color={Colors.light.background} /> : <Ionicons name="checkmark" size={20} color={Colors.light.background} />}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ============================================================
  // MODE DICTÉE
  // ============================================================
  if (isDictation) {
    const isLast = currentIndex === totalSentences - 1;
    const isFirst = currentIndex === 0;

    return (
      <View style={[styles.container, styles.agentContainer]}>
        <View style={[styles.bubble, styles.agentBubble, styles.dictationBubble]}>
          <View style={styles.dictationHeader}>
            <Ionicons name="mic-outline" size={16} color={Colors.light.primary} />
            <Text style={styles.dictationLabel}>Dictée</Text>
            {totalSentences > 1 && (
              <Text style={styles.dictationProgress}>Phrase {currentIndex + 1}/{totalSentences}</Text>
            )}
          </View>
          {!isRevealed ? (
            <>
              <Text style={styles.dictationHint}>🔒 Écoute bien la phrase, puis écris-la sur ton cahier.</Text>
              <View style={styles.dictationActions}>
                <TouchableOpacity style={styles.dictationButton} onPress={handleSpeak}>
                  <Ionicons name={isPlaying ? 'stop-circle-outline' : 'volume-medium-outline'} size={18} color={Colors.light.background} />
                  <Text style={styles.dictationButtonText}>{isPlaying ? 'Arrêter' : 'Réécouter'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dictationButton, styles.dictationButtonOutline]} onPress={() => setIsRevealed(true)}>
                  <Ionicons name="eye-outline" size={18} color={Colors.light.primary} />
                  <Text style={[styles.dictationButtonText, styles.dictationButtonTextOutline]}>Révéler</Text>
                </TouchableOpacity>
              </View>
              {totalSentences > 1 && (
                <View style={styles.dictationNav}>
                  <TouchableOpacity
                    style={[styles.dictationNavButton, isFirst && styles.dictationNavButtonDisabled]}
                    onPress={handlePrevious}
                    disabled={isFirst}
                  >
                    <Ionicons name="arrow-back" size={18} color={isFirst ? Colors.light.textSecondary : Colors.light.primary} />
                    <Text style={[styles.dictationNavText, isFirst && styles.dictationNavTextDisabled]}>Précédent</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dictationNavButton, isLast && styles.dictationNavButtonDisabled]}
                    onPress={handleNext}
                    disabled={isLast}
                  >
                    <Text style={[styles.dictationNavText, isLast && styles.dictationNavTextDisabled]}>{isLast ? 'Terminer' : 'Suivant'}</Text>
                    <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={18} color={isLast ? Colors.light.textSecondary : Colors.light.primary} />
                  </TouchableOpacity>
                </View>
              )}
              {isLast && totalSentences === 1 && (
                <Text style={styles.dictationEndHint}>✅ Quand tu as fini, montre-moi ton cahier en photo 📷</Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.dictationRevealedTitle}>📖 Texte révélé</Text>
              {sentences.map((s, i) => (
                <Text
                  key={i}
                  style={[styles.dictationRevealedText, i === currentIndex && styles.dictationRevealedTextActive]}
                >
                  {i + 1}. {s}
                </Text>
              ))}
              <TouchableOpacity
                style={[styles.dictationButton, styles.dictationButtonOutline, { marginTop: Spacing.three }]}
                onPress={() => setIsRevealed(false)}
              >
                <Ionicons name="eye-off-outline" size={18} color={Colors.light.primary} />
                <Text style={[styles.dictationButtonText, styles.dictationButtonTextOutline]}>Recacher</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  // ============================================================
  // MODE MESSAGE NORMAL
  // ============================================================
  const cleanedText = isUser ? text : cleanDsmlTags(text);

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.agentContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.agentText]}>{cleanedText}</Text>

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
  container: { marginVertical: Spacing.two, paddingHorizontal: Spacing.three, flexDirection: 'row' },
  userContainer: { justifyContent: 'flex-end' },
  agentContainer: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', paddingVertical: Spacing.three, paddingHorizontal: Spacing.three, borderRadius: Spacing.four },
  userBubble: { backgroundColor: Colors.light.primary, borderBottomRightRadius: Spacing.one },
  agentBubble: { backgroundColor: Colors.light.backgroundElement, borderBottomLeftRadius: Spacing.one },
  text: { fontSize: 15, lineHeight: 21 },
  userText: { color: Colors.light.background },
  agentText: { color: Colors.light.text },
  speakButton: { marginTop: Spacing.two, alignSelf: 'flex-start' },

  dictationBubble: { backgroundColor: '#FFF8E1', borderWidth: 2, borderColor: Colors.light.primary, borderStyle: 'dashed', minWidth: 260 },
  dictationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.two, gap: Spacing.one },
  dictationLabel: { fontSize: 12, fontWeight: '700', color: Colors.light.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  dictationProgress: { fontSize: 12, color: Colors.light.textSecondary, marginLeft: 'auto', fontWeight: '600' },
  dictationHint: { fontSize: 14, color: Colors.light.text, marginBottom: Spacing.three, lineHeight: 20 },
  dictationActions: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  dictationButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, backgroundColor: Colors.light.primary, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Spacing.two },
  dictationButtonOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.light.primary },
  dictationButtonText: { fontSize: 14, fontWeight: '600', color: Colors.light.background },
  dictationButtonTextOutline: { color: Colors.light.primary },
  dictationNav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.three, paddingTop: Spacing.three, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  dictationNavButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.two, paddingHorizontal: Spacing.two },
  dictationNavButtonDisabled: { opacity: 0.4 },
  dictationNavText: { fontSize: 14, fontWeight: '600', color: Colors.light.primary },
  dictationNavTextDisabled: { color: Colors.light.textSecondary },
  dictationEndHint: { fontSize: 12, color: Colors.light.textSecondary, marginTop: Spacing.three, fontStyle: 'italic', textAlign: 'center' },
  dictationRevealedTitle: { fontSize: 14, fontWeight: '700', color: Colors.light.primary, marginBottom: Spacing.two },
  dictationRevealedText: { fontSize: 15, color: Colors.light.text, lineHeight: 22, marginBottom: Spacing.one },
  dictationRevealedTextActive: { fontWeight: '700', color: Colors.light.primary },

  quizBubble: { backgroundColor: '#E8F5E9', borderWidth: 2, borderColor: '#2E7D32', minWidth: 280 },
  quizFinishedBubble: { backgroundColor: '#FFF3E0', borderColor: '#FFB300' },
  quizFinishedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2E7D32', paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Spacing.one, marginLeft: 'auto' },
  quizFinishedBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.light.background, textTransform: 'uppercase', letterSpacing: 0.5 },
  quizScoreContainer: { alignItems: 'center', paddingVertical: Spacing.four, gap: Spacing.two },
  quizScoreText: { fontSize: 36, fontWeight: '800', color: '#2E7D32' },
  quizScoreLabel: { fontSize: 14, color: Colors.light.text, textAlign: 'center', fontStyle: 'italic' },
  quizFinishedHint: { fontSize: 12, color: Colors.light.textSecondary, textAlign: 'center', fontStyle: 'italic', marginTop: Spacing.two },
  quizHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.three, gap: Spacing.one },
  quizLabel: { fontSize: 12, fontWeight: '700', color: '#2E7D32', textTransform: 'uppercase', letterSpacing: 0.5 },
  quizProgress: { fontSize: 12, color: Colors.light.textSecondary, marginLeft: 'auto', fontWeight: '600' },
  quizQuestionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.three, gap: Spacing.two },
  quizQuestion: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.light.text, lineHeight: 22 },
  quizSpeakButton: { padding: Spacing.one },
  quizInputContainer: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  quizInput: { flex: 1, backgroundColor: Colors.light.background, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Spacing.two, fontSize: 16, color: Colors.light.text, borderWidth: 1, borderColor: '#A5D6A7' },
  quizMicIcon: { width: 44, height: 44, borderRadius: Spacing.two, backgroundColor: Colors.light.backgroundElement, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#A5D6A7' },
  quizValidateButton: { backgroundColor: '#2E7D32', width: 44, height: 44, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  quizValidateButtonDisabled: { backgroundColor: '#C8E6C9' },
  quizFeedbackContainer: { marginTop: Spacing.two },
  quizFeedbackBubble: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Spacing.two, marginBottom: Spacing.two },
  quizFeedbackCorrect: { backgroundColor: '#C8E6C9' },
  quizFeedbackWrong: { backgroundColor: '#FFCDD2' },
  quizFeedbackAlmost: { backgroundColor: '#FFE0B2' },
  quizFeedbackText: { fontSize: 15, fontWeight: '700' },
  quizFeedbackTextCorrect: { color: '#2E7D32' },
  quizFeedbackTextWrong: { color: '#C62828' },
  quizFeedbackTextAlmost: { color: '#E65100' },
  quizFeedbackExpected: { fontSize: 14, color: Colors.light.text, marginBottom: Spacing.two, fontStyle: 'italic' },
  quizFeedbackAlmostHint: { fontSize: 13, color: '#E65100', marginBottom: Spacing.two, fontStyle: 'italic' },
  quizFeedbackExpectedBold: { fontWeight: '700', color: '#2E7D32' },
  quizFeedbackExplanation: { fontSize: 13, color: Colors.light.text, marginBottom: Spacing.two, lineHeight: 19, backgroundColor: '#F5F5F5', padding: Spacing.two, borderRadius: Spacing.one },
  quizButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: Spacing.two, marginTop: Spacing.two },
  quizButtonPrimary: { backgroundColor: Colors.light.primary },
  quizButtonSuccess: { backgroundColor: '#2E7D32' },
  quizButtonText: { fontSize: 15, fontWeight: '700', color: Colors.light.background },
  quizMicContainer: { marginTop: Spacing.two },
  quizMicRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  quizMicText: { fontSize: 15, fontWeight: '600', color: '#C62828' },
  quizMicTextIdle: { color: Colors.light.textSecondary },
  quizMicTranscript: { fontSize: 16, color: Colors.light.text, fontStyle: 'italic', paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, backgroundColor: Colors.light.background, borderRadius: Spacing.two, marginBottom: Spacing.two },
  quizMicHint: { fontSize: 14, color: Colors.light.textSecondary, fontStyle: 'italic', paddingVertical: Spacing.two, marginBottom: Spacing.two },
  quizMicActions: { flexDirection: 'row', gap: Spacing.two },
  quizMicButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.three, borderRadius: Spacing.two },
  quizMicButtonCancel: { backgroundColor: '#C62828' },
  quizMicButtonValidate: { backgroundColor: '#2E7D32' },
  quizMicButtonText: { fontSize: 15, fontWeight: '700', color: Colors.light.background },
});