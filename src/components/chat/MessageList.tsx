import { useCallback, useEffect, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  isError?: boolean;
  originalText?: string;
  visual?: VisualData;
};

type Props = {
  messages: ChatMessage[];
  emptyText: string;
  agentId?: string;
  onQuizAnswer?: (messageId: string, questionIndex: number, userAnswer: string) => void;
  onRetry?: (originalText: string) => void;
};

const BOTTOM_THRESHOLD = 80;

export default function MessageList({ messages, emptyText, agentId, onQuizAnswer, onRetry }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef(false);
  const isAtBottom = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);
  const hasInitialScrolled = useRef(false);
  const lastAgentIdRef = useRef<string | undefined>(agentId);

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
  const messagesCount = visibleMessages.length;

  useEffect(() => {
    if (messagesCount === 0) {
      hasInitialScrolled.current = false;
      lastMessageIdRef.current = null;
    }
  }, [messagesCount]);

  // BUG #13 : Scroll auto quand l'agent change
  useEffect(() => {
    if (!agentId) return;
    if (lastAgentIdRef.current === agentId) return;

    lastAgentIdRef.current = agentId;

    hasInitialScrolled.current = false;
    isAtBottom.current = true;
    isUserScrolling.current = false;
    lastMessageIdRef.current = null;

    scrollRef.current?.scrollToEnd({ animated: false });

    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
      hasInitialScrolled.current = true;
      lastMessageIdRef.current = lastMessageId;
    }, 100);

    return () => clearTimeout(timer);
  }, [agentId, lastMessageId]);

  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    if (hasInitialScrolled.current) return;
    if (h <= 0) return;

    scrollRef.current?.scrollToEnd({ animated: false });

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
      hasInitialScrolled.current = true;
      lastMessageIdRef.current = lastMessageId;
    }, 50);
  }, [lastMessageId]);

  useEffect(() => {
    if (!lastMessageId) return;
    if (!hasInitialScrolled.current) return;
    if (lastMessageId === lastMessageIdRef.current) return;

    if (!isAtBottom.current || isUserScrolling.current) {
      lastMessageIdRef.current = lastMessageId;
      return;
    }

    lastMessageIdRef.current = lastMessageId;

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [lastMessageId]);

  const handleScrollBeginDrag = () => {
    isUserScrolling.current = true;
  };

  const handleScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    isAtBottom.current = distanceFromBottom < BOTTOM_THRESHOLD;
    isUserScrolling.current = false;
  };

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
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.listContent}
      onContentSizeChange={handleContentSizeChange}
      onScroll={handleScroll}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
    >
      {visibleMessages.map((item) => (
        <Message
          key={item.id}
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
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
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