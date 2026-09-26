import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AgentMenu from '@/components/common/AgentMenu';
import Header from '@/components/common/Header';
import SettingsModal from '@/components/common/SettingsModal';
import { Colors, Spacing } from '@/constants/theme';

const AGENTS = [
  { id: 'sante', name: 'Agent Santé' },
  { id: 'prof', name: 'Agent Prof' },
];

export default function HomeScreen() {
  const [agentMenuVisible, setAgentMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const selectedAgent = AGENTS.find((a) => a.id === selectedAgentId);
  const headerTitle = selectedAgent ? selectedAgent.name : 'Aucun agent';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        agentName={headerTitle}
        onOpenAgents={() => setAgentMenuVisible(true)}
        onOpenSettings={() => setSettingsVisible(true)}
      />

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.messages}>
          <Text style={styles.placeholder}>
            {selectedAgent
              ? `Conversation avec ${selectedAgent.name}`
              : 'Sélectionne un agent dans le menu pour commencer.'}
          </Text>
        </View>
      </KeyboardAvoidingView>

      <AgentMenu
        visible={agentMenuVisible}
        agents={AGENTS}
        selectedAgentId={selectedAgentId}
        onSelectAgent={(id) => {
          setSelectedAgentId(id);
          setAgentMenuVisible(false);
        }}
        onClose={() => setAgentMenuVisible(false)}
      />

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  body: {
    flex: 1,
  },
  messages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  placeholder: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});