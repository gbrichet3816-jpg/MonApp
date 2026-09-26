import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

import Message from './Message';

export type ChatMessage = {
  id: string;
  text: string;
  isUser: boolean;
};

type Props = {
  messages: ChatMessage[];
  emptyText: string;
};

export default function MessageList({ messages, emptyText }: Props) {
  if (messages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <Message text={item.text} isUser={item.isUser} />}
      contentContainerStyle={styles.listContent}
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