import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

type Agent = {
  id: string;
  name: string;
};

type Props = {
  visible: boolean;
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
  onClose: () => void;
};

export default function AgentMenu({ visible, agents, selectedAgentId, onSelectAgent, onClose }: Props) {
  // 🆕 Bug #4 : safe area pour ne pas cacher le bouton sous la barre système
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { paddingBottom: insets.bottom + Spacing.four }]}>
          <Text style={styles.title}>Choisir un agent</Text>

          {agents.length === 0 ? (
            <Text style={styles.empty}>Aucun agent disponible</Text>
          ) : (
            agents.map((agent) => (
              <TouchableOpacity
                key={agent.id}
                style={[styles.item, selectedAgentId === agent.id && styles.itemSelected]}
                onPress={() => onSelectAgent(agent.id)}
              >
                <Text
                  style={[styles.itemText, selectedAgentId === agent.id && styles.itemTextSelected]}
                >
                  {agent.name}
                </Text>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: Spacing.three,
  },
  item: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
  },
  itemSelected: {
    backgroundColor: Colors.light.primary,
  },
  itemText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  itemTextSelected: {
    color: Colors.light.background,
    fontWeight: '600',
  },
  empty: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  closeButton: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '600',
  },
});