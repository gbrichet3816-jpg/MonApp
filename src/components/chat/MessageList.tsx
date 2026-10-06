import { useEffect, useRef } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';

import type { VisualData } from '@/utils/visualParser';
import Message, { type QuizQuestion } from './Message';

export type ChatMessage = {
  id: string;
  text: string;
  isUser: boolean;
  isDictation?: boolean;
  isQuiz?: boolean;
  quizTitle?: string;
  quizQuestions?: QuizQuestion[];
  // 🆕 A10 : pour bouton Relancer
  isError?: boolean;
  originalText?: string;
  // 🆕 A7 v3 : visuel
  visual?: VisualData;
};

type Props = {
  messages: ChatMessage[];
  emptyText: string;
  onQuizAnswer?: (messageId: string, questionIndex: number, userAnswer: string) => void;
  onRetry?: (originalText: string) => void;
};

// Distance du bas (en px) en dessous de laquelle on considère
// que l'utilisateur est "collé en bas"
const BOTTOM_THRESHOLD = 80;

export default function MessageList({ messages, emptyText, onQuizAnswer, onRetry }: Props) {
  const listRef = useRef<FlatList<ChatMessage>>(null);
  // 🆕 Flag : l'utilisateur est-il en train de scroller manuellement ?
  const isUserScrolling = useRef(false);
  // 🆕 Flag : est-on collé en bas de la liste ?
  const isAtBottom = useRef(true);
  // 🆕 Dernier ID de message affiché (pour ne scroller QUE sur nouveau message)
  const lastMessageIdRef = useRef<string | null>(null);

  const visibleMessages = messages.filter((msg) => {
    if (msg.isQuiz) return true;
    if (msg.isDictation) return true;
    if (msg.visual) return true;

    if (!msg.text || !msg.text.trim()) return false;

    if (msg.text.startsWith('__QUIZ__:') || msg.text.startsWith('__DICTATION__:')) {
      return false;
    }

    if (msg.text.startsWith('[QUIZ] ')) return false;

    return true;
  });

  const lastMessage = visibleMessages[visibleMessages.length - 1];
  const lastMessageId = lastMessage?.id || null;
  const hasActiveQuiz = lastMessage?.isQuiz === true;

  // 🆕 Scroll auto UNIQUEMENT si un NOUVEAU message arrive ET qu'on est en bas
  useEffect(() => {
    if (hasActiveQuiz) return;

    // On scrolle seulement si le dernier message a changé
    if (!lastMessageId || lastMessageId === lastMessageIdRef.current) return;

    // On scrolle seulement si l'utilisateur est déjà en bas (pas en train de lire)
    if (!isAtBottom.current) {
      lastMessageIdRef.current = lastMessageId;
      return;
    }

    // On scrolle seulement si l'utilisateur ne scrolle pas manuellement
    if (isUserScrolling.current) {
      lastMessageIdRef.current = lastMessageId;
      return;
    }

    lastMessageIdRef.current = lastMessageId;

    // Délai pour laisser le rendu se faire
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [lastMessageId, hasActiveQuiz]);

  // 🆕 Détecte si l'utilisateur touche l'écran (scroll manuel)
  const handleScrollBeginDrag = () => {
    isUserScrolling.current = true;
  };

  // 🆕 Détecte la fin du scroll manuel et met à jour isAtBottom
  const handleScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    isAtBottom.current = distanceFromBottom < BOTTOM_THRESHOLD;
    isUserScrolling.current = false;
  };

  // 🆕 Détecte le scroll en cours (mise à jour continue de isAtBottom)
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    isAtBottom.current = distanceFromBottom < BOTTOM_THRESHOLD;
  };

  if (visibleMessages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={visibleMessages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Message
          text={item.text}
          isUser={item.isUser}
          isDictation={item.isDictation}
          autoSpeak={item.isDictation}
          isQuiz={item.isQuiz}
          quizTitle={item.quizTitle}
          quizQuestions={item.quizQuestions}
          onQuizAnswer={(questionIndex, userAnswer) => {
            onQuizAnswer?.(item.id, questionIndex, userAnswer);
          }}
          isError={item.isError}
          onRetry={item.isError && item.originalText ? () => onRetry?.(item.originalText!) : undefined}
          visual={item.visual}
        />
      )}
      contentContainerStyle={styles.listContent}
      // 🆕 Handlers de scroll
      onScroll={handleScroll}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
      scrollEventThrottle={16}
      // 🆕 On garde onContentSizeChange MAIS on ne scrolle plus automatiquement dedans
      // On l'utilise uniquement pour détecter les changements de taille
      onContentSizeChange={() => {
        // Rien à faire ici : le scroll auto est géré par le useEffect ci-dessus
        // Ce handler est conservé pour éviter les warnings et permet de futurs ajustements
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: Spacing.three,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});