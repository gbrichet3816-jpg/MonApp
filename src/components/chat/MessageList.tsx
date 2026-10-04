import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

import Message, { type QuizQuestion } from './Message';

export type ChatMessage = {
  id: string;
  text: string;
  isUser: boolean;
  isDictation?: boolean;
  isQuiz?: boolean;
  quizTitle?: string;
  quizQuestions?: QuizQuestion[];
};

type Props = {
  messages: ChatMessage[];
  emptyText: string;
  onQuizAnswer?: (messageId: string, questionIndex: number, userAnswer: string) => void;
};

export default function MessageList({ messages, emptyText, onQuizAnswer }: Props) {
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // 🆕 Bug #2 : filtrer les messages "techniques" qui ne doivent pas apparaître dans le chat
  const visibleMessages = messages.filter((msg) => {
    // Ignore les messages dont le texte est vide
    if (!msg.text || !msg.text.trim()) return false;

    // Ignore les messages quiz (ils sont rendus par isQuiz=true, pas par le texte)
    if (msg.isQuiz) return true;

    // Ignore les messages dictée (rendus par isDictation=true)
    if (msg.isDictation) return true;

    // Ignore les marqueurs techniques internes
    if (msg.text.startsWith('__QUIZ__:') || msg.text.startsWith('__DICTATION__:')) {
      return false;
    }

    // Ignore les messages de type "[QUIZ] ..." (marqueurs de sauvegarde)
    if (msg.text.startsWith('[QUIZ] ')) return false;

    return true;
  });

  useEffect(() => {
    if (visibleMessages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [visibleMessages.length]);

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
        />
      )}
      contentContainerStyle={styles.listContent}
      onContentSizeChange={() => {
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
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});