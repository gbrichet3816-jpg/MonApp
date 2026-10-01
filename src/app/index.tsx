import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AGENTS } from '@/agents';
import {
  scheduleMultipleDailyReminders,
  scheduleMultipleOneTimeReminders,
  scheduleRelativeReminder,
} from '@/agents/sante/reminders';
import { FileAction, ImportedFile } from '@/components/chat/FileImporter';
import FileMessageModal from '@/components/chat/FileMessageModal';
import InputBar from '@/components/chat/InputBar';
import MessageList, { ChatMessage } from '@/components/chat/MessageList';
import PhotoMessageModal, { PhotoAction } from '@/components/chat/PhotoMessageModal';
import AgentMenu from '@/components/common/AgentMenu';
import Header from '@/components/common/Header';
import Onboarding from '@/components/common/Onboarding';
import SettingsModal from '@/components/common/SettingsModal';
import { ApiMessage, extractPdfText, sendMessageToAgent, ToolCall } from '@/config/api';
import {
  deactivateAllReminders,
  deactivateRemindersByName,
  findRemindersToAsk,
  initDatabase,
  loadMessages,
  loadReminders,
  markRemindersAsAsked,
  saveDocument,
  saveMessage,
  savePreference,
  saveReminder,
  setReminderResponse,
} from '@/config/database';
import { saveFileToDocuments } from '@/config/files';
import { requestNotificationPermission } from '@/config/notifications';
import { getLocalProfile } from '@/config/user';
import { Colors } from '@/constants/theme';

function decodeBase64Utf8(base64: string): string {
  try {
    const binaryString = (global as any).atob
      ? (global as any).atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');

    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    console.error('Erreur décodage base64:', e);
    return '';
  }
}

export default function HomeScreen() {
  const [agentMenuVisible, setAgentMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [pendingFile, setPendingFile] = useState<ImportedFile | null>(null);
  const [fileModalVisible, setFileModalVisible] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    initDatabase();
    requestNotificationPermission();

    const profile = getLocalProfile();
    if (!profile) {
      setNeedsOnboarding(true);
    }
    setProfileReady(true);

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
  ): Promise<ChatMessage[]> => {
    const resultMessages: ChatMessage[] = [];

    for (const call of toolCalls) {
      const args = call.arguments as any;

      if (call.name === 'createDocument') {
        const docId = `doc-${Date.now()}`;
        saveDocument({
          id: docId,
          agentId,
          title: args.title,
          content: args.content,
        });
        resultMessages.push({
          id: `agent-${Date.now()}-doc`,
          text: `C'est fait ! J'ai créé "${args.title}" dans ta bibliothèque.`,
          isUser: false,
        });
      } else if (call.name === 'createDailyReminders') {
        const medicationName = args.medicationName;
        const times: string[] = args.times || [];

        if (times.length === 0) continue;

        const baseId = `reminder-${Date.now()}`;
        const results = await scheduleMultipleDailyReminders({
          medicationName,
          times,
          baseId,
        });

        if (results.length > 0) {
          results.forEach((r) => {
            saveReminder({
              id: r.reminderId,
              agentId,
              medicationName,
              time: r.time,
              notificationId: r.notificationId,
              reminderType: 'daily',
            });
          });

          const timesFormatted = times.map((t) => t.replace(':', 'h')).join(', ');
          const suffix = times.length > 1 ? 's' : '';

          resultMessages.push({
            id: `agent-${Date.now()}-rem`,
            text: `C'est noté ! Je te rappellerai tous les jours à ${timesFormatted} de prendre ${medicationName}. (${times.length} rappel${suffix})`,
            isUser: false,
          });
        }
      } else if (call.name === 'createOneTimeReminders') {
        const medicationName = args.medicationName;
        const dateTimes: string[] = args.dateTimes || [];

        if (dateTimes.length === 0) continue;

        const baseId = `reminder-${Date.now()}`;
        const results = await scheduleMultipleOneTimeReminders({
          medicationName,
          dateTimes,
          baseId,
        });

        if (results.length > 0) {
          results.forEach((r) => {
            const date = new Date(r.scheduledAt);
            const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

            saveReminder({
              id: r.reminderId,
              agentId,
              medicationName,
              time: timeStr,
              notificationId: r.notificationId,
              reminderType: 'onetime',
              scheduledAt: r.scheduledAt,
            });
          });

          const suffix = results.length > 1 ? 's' : '';
          resultMessages.push({
            id: `agent-${Date.now()}-rem`,
            text: `C'est noté ! J'ai créé ${results.length} rappel${suffix} pour ${medicationName}.`,
            isUser: false,
          });
        }
      } else if (call.name === 'createRelativeReminder') {
        const medicationName = args.medicationName;
        const minutesFromNow = args.minutesFromNow;
        const reminderId = `reminder-${Date.now()}`;

        const { notificationId, scheduledAt } = await scheduleRelativeReminder({
          medicationName,
          minutesFromNow,
          reminderId,
        });

        if (notificationId && scheduledAt) {
          const date = new Date(scheduledAt);
          const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          const label = minutesFromNow >= 60
            ? `${Math.round(minutesFromNow / 60)}h`
            : `${minutesFromNow} min`;

          saveReminder({
            id: reminderId,
            agentId,
            medicationName,
            time: timeStr,
            notificationId,
            reminderType: 'relative',
            scheduledAt,
          });
          resultMessages.push({
            id: `agent-${Date.now()}-rem`,
            text: `D'accord ! Je te rappelle dans ${label} pour ${medicationName}.`,
            isUser: false,
          });
        }
      } else if (call.name === 'saveUserPreference') {
        savePreference(args.preferenceKey, args.preferenceValue);
        resultMessages.push({
          id: `agent-${Date.now()}-pref`,
          text: `C'est noté ! J'ai bien enregistré ta préférence.`,
          isUser: false,
        });
      } else if (call.name === 'cancelReminders') {
        if (args.medicationName) {
          deactivateRemindersByName(agentId, args.medicationName);
          resultMessages.push({
            id: `agent-${Date.now()}-cancel`,
            text: `C'est fait ! J'ai annulé les rappels pour ${args.medicationName}.`,
            isUser: false,
          });
        } else {
          deactivateAllReminders(agentId);
          resultMessages.push({
            id: `agent-${Date.now()}-cancel`,
            text: `C'est fait ! J'ai annulé tous tes rappels.`,
            isUser: false,
          });
        }
      } else if (call.name === 'listReminders') {
        const reminders = loadReminders(agentId);
        if (reminders.length === 0) {
          resultMessages.push({
            id: `agent-${Date.now()}-list`,
            text: `Tu n'as aucun rappel actif pour le moment.`,
            isUser: false,
          });
        } else {
          const list = reminders
            .map((r) => `• ${r.medication_name} à ${r.time.replace(':', 'h')} (${r.reminder_type === 'daily' ? 'tous les jours' : r.reminder_type === 'onetime' ? 'une fois' : 'relatif'})`)
            .join('\n');
          resultMessages.push({
            id: `agent-${Date.now()}-list`,
            text: `Voici tes rappels actifs :\n\n${list}`,
            isUser: false,
          });
        }
      }
    }

    return resultMessages;
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

    setIsLoading(true);

    try {
      const apiMessages: ApiMessage[] = newMessages.map((m) => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.text,
      }));

      const result = await sendMessageToAgent({
        messages: apiMessages,
        agentSystemPrompt: selectedAgent.systemPrompt,
        enableTools: (selectedAgent as any).enableTools === true,
        agentId: selectedAgent.id,
      });

      if (!isMounted.current) return;

      if (result.toolCalls && result.toolCalls.length > 0) {
        const toolMessages = await handleToolCalls(result.toolCalls, selectedAgent.id);

        toolMessages.forEach((msg) => {
          setMessages((prev) => [...prev, msg]);
          saveMessage({
            id: msg.id,
            agentId: selectedAgent.id,
            text: msg.text,
            isUser: false,
          });
        });

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

  const handleFilePicked = (file: ImportedFile) => {
    setPendingFile(file);
    setFileModalVisible(true);
  };

  const handleFileSend = async (message: string, action: FileAction) => {
    setFileModalVisible(false);
    if (!pendingFile || !selectedAgent) return;

    // Cas 1 : Enregistrer seulement
    if (action === 'save') {
      const docId = `doc-file-${Date.now()}`;
      const savedPath = await saveFileToDocuments(pendingFile.uri, pendingFile.fileName);

      saveDocument({
        id: docId,
        agentId: selectedAgent.id,
        title: pendingFile.title,
        content: '',
        filePath: savedPath || undefined,
        fileType: pendingFile.mimeType,
      });

      Alert.alert('Enregistré !', `"${pendingFile.title}" est dans ta bibliothèque.`);
      setPendingFile(null);
      return;
    }

    // Cas 2 : Envoyer + Enregistrer
    if (action === 'agent+save') {
      const docId = `doc-file-${Date.now()}`;
      const savedPath = await saveFileToDocuments(pendingFile.uri, pendingFile.fileName);

      saveDocument({
        id: docId,
        agentId: selectedAgent.id,
        title: pendingFile.title,
        content: message || '',
        filePath: savedPath || undefined,
        fileType: pendingFile.mimeType,
      });
    }

    // Cas 3 (défaut) : Envoyer à l'agent
    const isImage = pendingFile.type === 'image';
    const isPdf = pendingFile.type === 'pdf';
    const isText = pendingFile.type === 'text';

    const userText = message || (
      isImage ? 'Analyse cette image' :
      isPdf ? 'Analyse ce PDF' :
      isText ? 'Analyse ce document texte' :
      `Fichier : ${pendingFile.fileName}`
    );

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: message ? `📎 ${message}` : `📎 ${pendingFile.fileName}`,
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

    setIsLoading(true);

    try {
      let content: any = userText;

      if (isImage && pendingFile.base64) {
        content = [
          { type: 'text', text: userText },
          {
            type: 'image_url',
            image_url: { url: `data:${pendingFile.mimeType};base64,${pendingFile.base64}` },
          },
        ];
      } else if (isPdf && pendingFile.base64) {
        const extractResult = await extractPdfText(pendingFile.base64);

        if (extractResult.success && extractResult.text) {
          const pdfText = extractResult.text.slice(0, 15000);
          content = `${userText}\n\n--- Contenu du PDF "${pendingFile.fileName}" (${extractResult.pages} pages) ---\n\n${pdfText}`;
        } else {
          content = `${userText}\n\n[Impossible d'extraire le texte du PDF : ${extractResult.error || 'inconnu'}]`;
        }
      } else if (isText && pendingFile.base64) {
        try {
          const decodedText = decodeBase64Utf8(pendingFile.base64);
          const textContent = decodedText.slice(0, 15000);
          content = `${userText}\n\n--- Contenu du fichier "${pendingFile.fileName}" ---\n\n${textContent}`;
        } catch (e) {
          content = `${userText}\n\n[Impossible de lire le contenu du fichier : ${e}]`;
        }
      } else if (!isImage) {
        content = `[Fichier : ${pendingFile.fileName}]\n${message || 'Fichier envoyé'}`;
      }

      const apiMessages: ApiMessage[] = [
        ...newMessages.slice(0, -1).map((m) => ({
          role: m.isUser ? ('user' as const) : ('assistant' as const),
          content: m.text,
        })),
        { role: 'user', content },
      ];

      const result = await sendMessageToAgent({
        messages: apiMessages,
        agentSystemPrompt: selectedAgent.systemPrompt,
        enableTools: (selectedAgent as any).enableTools === true,
        agentId: selectedAgent.id,
      });

      if (!isMounted.current) return;

      const agentMessage: ChatMessage = {
        id: `agent-${Date.now()}`,
        text: result.reply || '(pas de réponse)',
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
      if (isMounted.current) setIsLoading(false);
      setPendingFile(null);
    }
  };

  const handleFileCancel = () => {
    setFileModalVisible(false);
    setPendingFile(null);
  };

  const handlePhotoTaken = (photoUri: string, base64?: string) => {
    setPendingPhoto({ uri: photoUri, base64 });
    setPhotoModalVisible(true);
  };

  const handlePhotoSend = async (message: string, action: PhotoAction) => {
    setPhotoModalVisible(false);
    if (!pendingPhoto || !selectedAgent) return;

    // Cas 1 : Enregistrer seulement
    if (action === 'save') {
      const docId = `doc-photo-${Date.now()}`;
      const fileName = `photo_${Date.now()}.jpg`;
      const savedPath = await saveFileToDocuments(pendingPhoto.uri, fileName);

      saveDocument({
        id: docId,
        agentId: selectedAgent.id,
        title: `Photo du ${new Date().toLocaleDateString('fr-FR')}`,
        content: '',
        filePath: savedPath || undefined,
        fileType: 'image/jpeg',
      });

      Alert.alert('Enregistré !', 'Photo enregistrée dans ta bibliothèque.');
      setPendingPhoto(null);
      return;
    }

    // Cas 2 : Envoyer + Enregistrer
    if (action === 'agent+save') {
      const docId = `doc-photo-${Date.now()}`;
      const fileName = `photo_${Date.now()}.jpg`;
      const savedPath = await saveFileToDocuments(pendingPhoto.uri, fileName);

      saveDocument({
        id: docId,
        agentId: selectedAgent.id,
        title: `Photo du ${new Date().toLocaleDateString('fr-FR')}`,
        content: message || '',
        filePath: savedPath || undefined,
        fileType: 'image/jpeg',
      });
    }

    // Cas 3 (défaut) : Envoyer à l'agent
    const userText = message || 'Analyse cette image';
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: message ? `📷 ${message}` : '📷 [Photo envoyée]',
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

    setIsLoading(true);

    try {
      const content: any = pendingPhoto.base64
        ? [
            { type: 'text', text: userText },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${pendingPhoto.base64}` },
            },
          ]
        : `[Photo envoyée sans message]`;

      const apiMessages: ApiMessage[] = [
        ...newMessages.slice(0, -1).map((m) => ({
          role: m.isUser ? ('user' as const) : ('assistant' as const),
          content: m.text,
        })),
        { role: 'user', content },
      ];

      const result = await sendMessageToAgent({
        messages: apiMessages,
        agentSystemPrompt: selectedAgent.systemPrompt,
        enableTools: (selectedAgent as any).enableTools === true,
        agentId: selectedAgent.id,
      });

      if (!isMounted.current) return;

      const agentMessage: ChatMessage = {
        id: `agent-${Date.now()}`,
        text: result.reply || '(pas de réponse)',
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
      if (isMounted.current) setIsLoading(false);
      setPendingPhoto(null);
    }
  };

  const handlePhotoCancel = () => {
    setPhotoModalVisible(false);
    setPendingPhoto(null);
  };

  const emptyText = selectedAgent
    ? `Conversation avec ${selectedAgent.name}. Écris ton premier message !`
    : 'Sélectionne un agent dans le menu pour commencer.';

  if (!profileReady) return null;

  if (needsOnboarding) {
    return <Onboarding onComplete={() => setNeedsOnboarding(false)} />;
  }

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
        <InputBar
          onSend={handleSend}
          onFilePicked={handleFilePicked}
          onPhotoTaken={handlePhotoTaken}
          disabled={!selectedAgent || isLoading}
        />
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

      <FileMessageModal
        visible={fileModalVisible}
        file={pendingFile}
        onSend={handleFileSend}
        onCancel={handleFileCancel}
      />

      <PhotoMessageModal
        visible={photoModalVisible}
        photoUri={pendingPhoto?.uri || ''}
        onSend={handlePhotoSend}
        onCancel={handlePhotoCancel}
      />
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