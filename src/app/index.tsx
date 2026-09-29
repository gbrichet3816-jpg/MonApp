import { useEffect, useRef, useState } from 'react';
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
  findRemindersToAsk,
  initDatabase,
  loadMessages,
  markRemindersAsAsked,
  saveMessage,
  saveReminder,
  setReminderResponse,
} from '@/config/database';
import { requestNotificationPermission } from '@/config/notifications';
import { Colors } from '@/constants/theme';

export default function HomeScreen() {
  const [agentMenuVisible, setAgentMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    initDatabase();
    requestNotificationPermission();

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      const saved = loadMessages(selectedAgentId);
      setMessages(saved);

      if (selectedAgentId === 'sante') {
        const timer = setTimeout(() => {
          if (isMounted.current) {
            checkPendingReminders();
          }
        }, 500);

        return () => clearTimeout(timer);
      }
    } else {
      setMessages([]);
    }
  }, [selectedAgentId]);

  const checkPendingReminders = () => {
    if (!isMounted.current) return;

    const remindersToAsk = findRemindersToAsk('sante');
    if (remindersToAsk.length === 0) return;

    const questions: ChatMessage[] = remindersToAsk.map((r, index) => ({
      id: `agent-pending-${Date.now()}-${index}`,
      text: `Tu avais un rappel pour ${r.medication_name} à ${r.time.replace(':', 'h')}. Tu l'as bien pris ?`,
      isUser: false,
    }));

    // Marque tous ces rappels comme "question posée"
    markRemindersAsAsked(remindersToAsk.map((r) => r.id));

    setMessages((prev) => {
      const newQuestions = questions.filter(
        (q) => !prev.some((m) => m.text === q.text),
      );
      if (newQuestions.length === 0) return prev;

      newQuestions.forEach((q) => {
        saveMessage({
          id: q.id,
          agentId: 'sante',
          text: q.text,
          isUser: false,
        });
      });

      return [...prev, ...newQuestions];
    });
  };

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

    // Si on est en train de répondre à un rappel en attente
    if (selectedAgent.id === 'sante') {
      const remindersToAsk = findRemindersToAsk('sante');
      // Cherche un rappel déjà "questionné" mais sans réponse
      const allReminders = remindersToAsk.length > 0 ? remindersToAsk : [];
      // On regarde plutôt tous les rappels actifs sans réponse
      if (allReminders.length > 0) {
        const lower = text.toLowerCase();
        const first = allReminders[0];
        if (lower.includes('oui') || lower.includes('pris')) {
          setReminderResponse(first.id, 'taken');
        } else if (lower.includes('non') || lower.includes('pas')) {
          setReminderResponse(first.id, 'not_taken');
        } else if (lower.includes('plus tard') || lower.includes('attends')) {
          setReminderResponse(first.id, 'later');
        }
      }
    }

    // Détection de création de rappel
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

      if (!isMounted.current) return;

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
      if (!isMounted.current) return;

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        text: `Erreur : ${error instanceof Error ? error.message : 'inconnue'}`,
        isUser: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
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