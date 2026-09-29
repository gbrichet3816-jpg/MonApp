import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  agentName: string;
  onOpenAgents: () => void;
  onOpenSettings: () => void;
};

export default function Header({ agentName, onOpenAgents, onOpenSettings }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.iconButton} onPress={onOpenAgents}>
        <Ionicons name="menu" size={26} color={Colors.light.primary} />
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>
        {agentName}
      </Text>

      <View style={styles.rightButtons}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push('/library')}
        >
          <Ionicons name="book-outline" size={22} color={Colors.light.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={onOpenSettings}>
          <Ionicons name="settings-outline" size={24} color={Colors.light.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  iconButton: {
    padding: Spacing.one,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginHorizontal: Spacing.two,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});