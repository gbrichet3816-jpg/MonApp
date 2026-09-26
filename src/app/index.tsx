import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import InputBar from '@/components/chat/InputBar';
import MessageList, { ChatMessage } from '@/components/chat/MessageList';
import AgentMenu from '@/components/common/AgentMenu';
import Header from '@/components/common/Header';
import SettingsModal from '@/components/common/SettingsModal';
import { Colors } from '@/constants/theme';

const AGENTS = [
  { id: 'sante', name: 'Agent Santé' },
  { id: 'prof', name: 'Agent Prof' },
];

export default function HomeScreen() {
  const [agentMenuVisible, setAgentMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const selectedAgent = AGENTS.find((a) => a.id === selectedAgentId);
  const headerTitle = selectedAgent ? selectedAgent.name : 'Aucun agent';

  const handleSend = (text: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text,
      isUser: true,
    };
    setMessages((prev) => [...prev, userMessage]);

    // Réponse temporaire de l'agent (sera remplacée par DeepSeek plus tard)
    setTimeout(() => {
      const agentMessage: ChatMessage = {
        id: `agent-${Date.now()}`,
        text: `Je suis ${selectedAgent?.name ?? "l'agent"}. Je te répondrai bientôt !`,
        isUser: false,
      };
      setMessages((prev) => [...prev, agentMessage]);
    }, 600);
  };

  const emptyText = selectedAgent
    ? `Conversation avec ${selectedAgent.name}. Écris ton premier message !`
    : 'Sélectionne un agent dans le menu pour commencer.';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Header
        agentName={headerTitle}
        onOpenAgents={() => setAgentMenuVisible(true)}
        onOpenSettings={() => setSettingsVisible(true)}
      />

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <MessageList messages={messages} emptyText={emptyText} />
        <InputBar onSend={handleSend} disabled={!selectedAgent} />
      </KeyboardAvoidingView>

      <AgentMenu
        visible={agentMenuVisible}
        agents={AGENTS}
        selectedAgentId={selectedAgentId}
        onSelectAgent={(id) => {
          setSelectedAgentId(id);
          setMessages([]);
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
});