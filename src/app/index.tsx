import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AGENTS } from '@/agents';
import {
  parseMedicationFromMessage,
  parseTimeFromMessage,
  scheduleMedicationReminder,
} from '@/agents/sante/reminders';
import InputBar from '@/components/chat/InputBar';
import MessageList, { ChatMessage } from '@/components/chat/MessageList';
import AgentMenu from '@/components/common/AgentMenu';
import Header from '@/components/common/Header';
import SettingsModal from '@/components/common/SettingsModal';
import { sendMessageToAgent } from '@/config/api';
import {
  initDatabase,
  loadMessages,
  saveMessage,
  saveReminder
} from '@/config/database';
import {
  registerNotificationTask,
  setupMedicationCategory,
} from '@/config/notifications';
import { Colors } from '@/constants/theme';

export default function HomeScreen() {
  const [agentMenuVisible, setAgentMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    initDatabase();
    setupMedicationCategory();
    registerNotificationTask();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      const saved = loadMessages(selectedAgentId);
      setMessages(saved);
    } else {
      setMessages([]);
    }
  }, [selectedAgentId]);

  const selectedAgent = AGENTS.find((a) => a.id === selectedAgentId);
  const headerTitle = selectedAgent ? selectedAgent.name : 'Aucun agent';

  const handleSend = async (text: string) => {
    if (!selectedAgent) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text,
      isUser: true,
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    saveMessage({
      id: userMessage.id,
      agentId: selectedAgent.id,
      text: userMessage.text,
      isUser: true,
    });

    if (selectedAgent.id === 'sante') {
      const time = parseTimeFromMessage(text);
      const medication = parseMedicationFromMessage(text);
      const mentionsReminder = /rappelle|rappel|médicament|medicament|prendre/i.test(text);

      if (time && mentionsReminder) {
        const medicationName = medication || 'ton médicament';
        const reminderId = `reminder-${Date.now()}`;

        try {
          const notificationId = await scheduleMedicationReminder({
            medicationName,
            time,
            reminderId,
          });

          if (notificationId) {
            saveReminder({
              id: reminderId,
              agentId: selectedAgent.id,
              medicationName,
              time,
              notificationId,
            });

            const confirmMessage: ChatMessage = {
              id: `agent-${Date.now()}`,
              text: `C'est noté ! Je te rappellerai de prendre ${medicationName} à ${time.replace(':', 'h')} chaque jour.`,
              isUser: false,
            };
            setMessages((prev) => [...prev, confirmMessage]);
            saveMessage({
              id: confirmMessage.id,
              agentId: selectedAgent.id,
              text: confirmMessage.text,
              isUser: false,
            });
            return;
          }
        } catch (error) {
          console.warn('Erreur création rappel:', error);
        }
      }
    }

    setIsLoading(true);

    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.isUser ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

      const reply = await sendMessageToAgent({
        messages: apiMessages,
        agentSystemPrompt: selectedAgent.systemPrompt,
      });

      const agentMessage: ChatMessage = {
        id: `agent-${Date.now()}`,
        text: reply,
        isUser: false,
      };
      setMessages((prev) => [...prev, agentMessage]);

      saveMessage({
        id: agentMessage.id,
        agentId: selectedAgent.id,
        text: agentMessage.text,
        isUser: false,
      });
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        text: `Erreur : ${error instanceof Error ? error.message : 'inconnue'}`,
        isUser: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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
      >
        <MessageList messages={messages} emptyText={emptyText} />
        <InputBar onSend={handleSend} disabled={!selectedAgent || isLoading} />
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
});