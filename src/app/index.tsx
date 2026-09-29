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
import { sendMessageToAgent, ToolCall } from '@/config/api';
import {
  findRemindersToAsk,
  initDatabase,
  loadMessages,
  markRemindersAsAsked,
  saveDocument,
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

  const handleToolCalls = async (
    toolCalls: ToolCall[],
    agentId: string,
  ): Promise<ChatMessage | null> => {
    for (const call of toolCalls) {
      if (call.name === 'createDocument') {
        const args = call.arguments as { title: string; content: string };

        const docId = `doc-${Date.now()}`;
        saveDocument({
          id: docId,
          agentId,
          title: args.title,
          content: args.content,
        });

        return {
          id: `agent-${Date.now()}`,
          text: `C'est fait ! J'ai créé "${args.title}" dans ta bibliothèque.`,
          isUser: false,
        };
      }
    }
    return null;
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

    if (selectedAgent.id === 'sante') {
      const remindersToAsk = findRemindersToAsk('sante');
      if (remindersToAsk.length > 0) {
        const lower = text.toLowerCase();
        const first = remindersToAsk[0];
        if (lower.includes('oui') || lower.includes('pris')) {
          setReminderResponse(first.id, 'taken');
        } else if (lower.includes('non') || lower.includes('pas')) {
          setReminderResponse(first.id, 'not_taken');
        } else if (lower.includes('plus tard') || lower.includes('attends')) {
          setReminderResponse(first.id, 'later');
        }
      }
    }

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

      const result = await sendMessageToAgent({
        messages: apiMessages,
        agentSystemPrompt: selectedAgent.systemPrompt,
        enableTools: (selectedAgent as any).enableTools === true,
      });

      if (!isMounted.current) return;

      // Si l'agent veut créer un document
      if (result.toolCalls && result.toolCalls.length > 0) {
        const toolMessage = await handleToolCalls(result.toolCalls, selectedAgent.id);
        if (toolMessage) {
          setMessages((prev) => [...prev, toolMessage]);
          saveMessage({
            id: toolMessage.id,
            agentId: selectedAgent.id,
            text: toolMessage.text,
            isUser: false,
          });
        }

        // S'il y a aussi un texte avec le tool call, on l'affiche
        if (result.reply) {
          const replyMessage: ChatMessage = {
            id: `agent-reply-${Date.now()}`,
            text: result.reply,
            isUser: false,
          };
          setMessages((prev) => [...prev, replyMessage]);
          saveMessage({
            id: replyMessage.id,
            agentId: selectedAgent.id,
            text: replyMessage.text,
            isUser: false,
          });
        }
      } else {
        const agentMessage: ChatMessage = {
          id: `agent-${Date.now()}`,
          text: result.reply,
          isUser: false,
        };
        setMessages((prev) => [...prev, agentMessage]);

        saveMessage({
          id: agentMessage.id,
          agentId: selectedAgent.id,
          text: agentMessage.text,
          isUser: false,
        });
      }
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