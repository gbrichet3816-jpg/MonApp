import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

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

export default function MessageList({ messages, emptyText, onQuizAnswer, onRetry }: Props) {
  const listRef = useRef<FlatList<ChatMessage>>(null);

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
  const hasActiveQuiz = lastMessage?.isQuiz === true;

  useEffect(() => {
    if (hasActiveQuiz) return;

    if (visibleMessages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [visibleMessages.length, hasActiveQuiz]);

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
      onContentSizeChange={() => {
        if (hasActiveQuiz) return;
        listRef.current?.scrollToEnd({ animated: true });
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