import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { speakText, stopSpeaking } from '@/config/speech';
import { Colors, Spacing } from '@/constants/theme';

type Props = {
  text: string;
  isUser: boolean;
  autoSpeak?: boolean;
};

export default function Message({ text, isUser, autoSpeak = false }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSpeak = () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    speakText(text, () => {
      setIsPlaying(false);
    });
  };

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
});