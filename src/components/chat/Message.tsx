import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  text: string;
  isUser: boolean;
};

export default function Message({ text, isUser }: Props) {
  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.agentContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.agentText]}>{text}</Text>
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
});