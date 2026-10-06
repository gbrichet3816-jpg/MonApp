import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, LogBox, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

LogBox.ignoreLogs([
  "Can't perform a React state update on a component that hasn't mounted yet",
]);

import { AGENTS } from '@/agents';
import {
  addProfEvent,
  addScheduleItem,
  canOfferReviewToday,
  clearSchedule,
  getAllTopics,
  getEventsAwaitingGrade,
  getEventsForDate,
  getEventsWithGrades,
  getFragileTopics,
  getProfProfile,
  getProfState,
  getSchedule,
  getTopicsToReview,
  markEveningBriefingSent,
  markGradeAsked,
  markMorningBriefingSent,
  markReviewOffered,
  markWeatherRefusalPrompted,
  openProfDatabase,
  saveEventGrade,
  saveTopicProgress,
  setWeatherCity,
  updateEveningBriefingTime,
  wasEveningBriefingSentToday,
  wasMorningBriefingSentToday,
} from '@/agents/prof/database';
import {
  extractGradeFromMessage,
  extractSubjectFromGradeMessage,
  formatEveningBriefingData,
  formatGradesForPrompt,
  formatPendingGradesContext,
  formatScheduleForPrompt,
  formatTopicsToReview,
  getDateContext,
  isBilanRequest,
  isGradesRequest
} from '@/agents/prof/helpers';
import {
  cancelEveningBriefing,
  getDefaultEveningHour,
  scheduleEveningBriefing,
  scheduleMorningBriefing,
} from '@/agents/prof/notifications';
import {
  shouldAskWeatherCity
} from '@/agents/prof/onboarding';
import {
  extractCityChangeFromMessage,
  extractCityFromMessage,
  fetchWeather,
  formatWeatherForPrompt,
  isWeatherQuestion,
} from '@/agents/prof/weather';
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
import {
  ApiMessage,
  extractPdfText,
  sendMessageToAgent,
  sendToolResultsToAgent,
  ToolCall,
} from '@/config/api';
import {
  checkpointDatabase,
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
import type { VisualData } from '@/utils/visualParser';

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

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

function isScheduleQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = [
    'emploi du temps', 'edt',
    'qu\'est-ce que j\'ai', 'qu est ce que j ai',
    'j\'ai quoi', 'j ai quoi',
    'cours demain', 'cours lundi', 'cours mardi', 'cours mercredi',
    'cours jeudi', 'cours vendredi',
    'matière demain', 'matiere demain', 'cette semaine',
  ];
  return keywords.some((k) => lower.includes(k));
}

function findToolResult(toolResults: string[], prefix: string): string | null {
  return toolResults.find((r) => r.startsWith(prefix)) || null;
}

function hasActiveQuiz(messages: ChatMessage[]): boolean {
  const visibleMessages = messages.filter((m) => m.isQuiz || (m.text && m.text.trim()));
  const last = visibleMessages[visibleMessages.length - 1];
  return last?.isQuiz === true;
}

// 🆕 Construit le bilan d'activité côté MOBILE (pas de tool needed)
async function buildActivityReportText(userId: string, days: number): Promise<string> {
  const profDb = await openProfDatabase();
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const sinceTimestamp = sinceDate.getTime();

  const allTopics = await getAllTopics(profDb, userId);
  const recentTopics = allTopics.filter((t) => t.last_seen >= sinceTimestamp);
  const eventsWithGrades = await getEventsWithGrades(profDb, userId);

  const totalNotions = recentTopics.length;
  const acquiredNotions = recentTopics.filter((t) => t.status === 'acquired').length;
  const fragileNotions = recentTopics.filter((t) => t.status === 'fragile').length;
  const inProgressNotions = recentTopics.filter((t) => t.status === 'in_progress').length;

  const bySubject: Record<string, { count: number; total: number; totalMax: number }> = {};
  for (const e of eventsWithGrades) {
    const s = e.subject || 'Autre';
    if (!bySubject[s]) bySubject[s] = { count: 0, total: 0, totalMax: 0 };
    if (e.grade !== null && e.grade_max) {
      bySubject[s].count++;
      bySubject[s].total += e.grade;
      bySubject[s].totalMax += e.grade_max;
    }
  }

  const estimatedMinutes = recentTopics.reduce((acc, t) => acc + (t.times_seen * 2), 0);
  const estimatedHours = Math.round((estimatedMinutes / 60) * 10) / 10;

  const lines: string[] = [`# 📊 BILAN D'ACTIVITÉ — ${days} derniers jours`, ''];

  if (totalNotions === 0) {
    lines.push('Aucune notion travaillée sur cette période.');
  } else {
    lines.push('## 🧠 Notions travaillées');
    lines.push(`- Total : ${totalNotions}`);
    lines.push(`- ✅ Acquises : ${acquiredNotions}`);
    lines.push(`- 🔄 En cours : ${inProgressNotions}`);
    lines.push(`- ⚠️ Fragiles : ${fragileNotions}`);
    lines.push('');
    lines.push('## ⏱️ Temps de travail estimé');
    lines.push(`- ${estimatedHours} h`);
    lines.push('');

    if (Object.keys(bySubject).length > 0) {
      lines.push('## 📝 Moyennes par matière');
      for (const [subject, stats] of Object.entries(bySubject)) {
        const moyenne = stats.totalMax > 0 ? (stats.total / stats.totalMax) * 20 : 0;
        lines.push(`- ${subject} : ${moyenne.toFixed(1)}/20 (${stats.count} note${stats.count > 1 ? 's' : ''})`);
      }
      lines.push('');
    }

    if (fragileNotions > 0) {
      const fragiles = recentTopics.filter((t) => t.status === 'fragile').slice(0, 3);
      lines.push('## ⚠️ Points fragiles à retravailler');
      for (const t of fragiles) {
        lines.push(`- ${t.subject} — ${t.topic}`);
      }
      lines.push('');
    }
  }

  lines.push('👉 Avec ces données, rédige un BILAN chaleureux pour le parent (3-5 paragraphes).');
  lines.push('Utilise les chiffres concrets, reste encourageant, propose un plan d\'action.');

  return lines.join('\n');
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function HomeScreen() {
  const params = useLocalSearchParams();

  const [agentMenuVisible, setAgentMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>('prof');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [pendingFile, setPendingFile] = useState<ImportedFile | null>(null);
  const [fileModalVisible, setFileModalVisible] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [prefillText, setPrefillText] = useState('');
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    initDatabase();
    requestNotificationPermission();
    const profile = getLocalProfile();
    if (!profile) setNeedsOnboarding(true);
    setProfileReady(true);
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        checkpointDatabase();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      try {
        const parsed = Linking.parse(url);
        console.log('🔗 Deep link reçu:', parsed);
        if (parsed.scheme?.startsWith('exp+')) return;

        if (parsed.path === 'prof' && parsed.queryParams?.notion) {
          const notion = String(parsed.queryParams.notion);
          setSelectedAgentId('prof');
          setPrefillText(`Explique-moi ${notion}`);
        }
      } catch (e) {
        console.warn('Erreur parsing deep link:', e);
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (params.notion && typeof params.notion === 'string') {
      console.log('🔗 Notion depuis deep link (redirect):', params.notion);
      setSelectedAgentId('prof');
      setPrefillText(`Explique-moi ${params.notion}`);
    }
  }, [params.notion]);

  useEffect(() => {
    if (selectedAgentId) {
      const saved = loadMessages(selectedAgentId);
      setMessages(saved);

      if (selectedAgentId === 'sante') {
        const timer = setTimeout(() => { if (isMounted.current) checkPendingReminders(); }, 500);
        return () => clearTimeout(timer);
      }
      if (selectedAgentId === 'prof') {
        // 🆕 Délai augmenté à 2500ms pour laisser SQLite s'ouvrir
        const timer = setTimeout(() => {
          if (isMounted.current) {
            checkReviewProposal();
            checkMorningBriefing();
            checkEveningBriefing();
            checkWeatherCityPrompt();
          }
        }, 2500);
        return () => clearTimeout(timer);
      }
    } else {
      setMessages([]);
    }
  }, [selectedAgentId]);

  const checkWeatherCityPrompt = async () => {
    try {
      const profile = getLocalProfile();
      if (!profile) return;
      const userId = profile.code ?? 'default';
      const db = await openProfDatabase();
      const should = await shouldAskWeatherCity(db, userId);
      if (!should) return;

      const askMessage: ChatMessage = {
        id: `agent-weather-ask-${Date.now()}`,
        text: `Au fait, tu ne m'as pas encore dit dans quelle ville tu habites 🙂\nComme ça je pourrai te donner la météo du matin !`,
        isUser: false,
      };
      setMessages((prev) => [...prev, askMessage]);
      saveMessage({ id: askMessage.id, agentId: 'prof', text: askMessage.text, isUser: false });
      await markWeatherRefusalPrompted(db, userId);
    } catch (e) {
      console.warn('[Prof] Erreur checkWeatherCityPrompt:', e);
    }
  };

  const checkMorningBriefing = async () => {
    try {
      const profile = getLocalProfile();
      if (!profile) return;
      const userId = profile.code ?? 'default';
      const db = await openProfDatabase();
      const state = await getProfState(db, userId);
      if (!state.morning_briefing_enabled) return;

      const alreadySent = await wasMorningBriefingSentToday(db, userId);
      if (alreadySent) return;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const briefingMinutes = state.morning_briefing_hour * 60 + state.morning_briefing_minute;
      if (currentMinutes < briefingMinutes) return;

      const today = new Date();
      const jsDay = today.getDay();
      const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
      const schedule = await getSchedule(db, userId, dayOfWeek);

      if (schedule.length === 0) {
        await markMorningBriefingSent(db, userId);
        return;
      }

      const coursesText = schedule.map((item) => `${item.subject} à ${item.start_time}`).join(', ');
      const childName = profile?.firstName ?? 'toi';

      const fullProfile = await getProfProfile(db, userId);
      let weatherText = '';

      if (fullProfile?.weather_city && fullProfile.weather_enabled === 1) {
        try {
          const weather = await fetchWeather(db, userId, fullProfile.weather_city);
          if (weather) {
            weatherText = `\n${weather.current.temp}°C, ${weather.current.description} ${weather.current.temp < 12 ? '— prends un pull !' : weather.current.temp > 25 ? '— pense à boire de l\'eau 💧' : ''}`;
          }
        } catch (e) {
          console.warn('[Prof] Erreur météo briefing:', e);
        }
      }

      const message = `Bonjour ${childName} ! 👋 Aujourd'hui tu as : ${coursesText}.${weatherText} Bonne journée ! 💪`;

      const briefingMessage: ChatMessage = {
        id: `agent-morning-${Date.now()}`,
        text: message,
        isUser: false,
      };
      setMessages((prev) => [...prev, briefingMessage]);
      saveMessage({ id: briefingMessage.id, agentId: 'prof', text: briefingMessage.text, isUser: false });
      await markMorningBriefingSent(db, userId);
    } catch (e) {
      console.warn('[Prof] Erreur checkMorningBriefing:', e);
    }
  };

  const checkEveningBriefing = async () => {
    try {
      const profile = getLocalProfile();
      if (!profile) return;
      const userId = profile.code ?? 'default';
      const db = await openProfDatabase();
      const state = await getProfState(db, userId);
      if (!state.evening_briefing_enabled) return;

      const alreadySent = await wasEveningBriefingSentToday(db, userId);
      if (alreadySent) return;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const briefingMinutes = state.evening_briefing_hour * 60 + state.evening_briefing_minute;
      if (currentMinutes < briefingMinutes) return;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const jsDay = tomorrow.getDay();
      const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

      const tomorrowEvents = await getEventsForDate(db, userId, tomorrow);
      const tomorrowSchedule = await getSchedule(db, userId, dayOfWeek);
      const fragileTopics = await getFragileTopics(db, userId);
      const pendingGrades = await getEventsAwaitingGrade(db, userId);

      if (
        tomorrowEvents.length === 0 &&
        fragileTopics.length === 0 &&
        tomorrowSchedule.length === 0 &&
        pendingGrades.length === 0
      ) {
        await markEveningBriefingSent(db, userId);
        return;
      }

      const eveningData = formatEveningBriefingData(
        tomorrowEvents,
        tomorrowSchedule,
        fragileTopics,
        pendingGrades
      );
      const enrichedPrompt = `${EVENING_BRIEFING_PROMPT}\n\n${getDateContext()}\n\n${eveningData}`;

      const apiMessages: ApiMessage[] = [{
        role: 'user',
        content: '[SYSTEME] Tu viens de recevoir les données du rappel du soir. Compose UN message court (3-5 lignes max) pour l\'enfant.',
      }];

      const result = await sendMessageToAgent({
        messages: apiMessages,
        agentSystemPrompt: enrichedPrompt,
        enableTools: false,
        agentId: 'prof',
      });

      if (!isMounted.current) return;
      if (!result.reply) {
        await markEveningBriefingSent(db, userId);
        return;
      }

      const eveningMessage: ChatMessage = {
        id: `agent-evening-${Date.now()}`,
        text: result.reply,
        isUser: false,
      };
      setMessages((prev) => [...prev, eveningMessage]);
      saveMessage({ id: eveningMessage.id, agentId: 'prof', text: eveningMessage.text, isUser: false });

      for (const ev of pendingGrades) {
        if (ev.id !== undefined) {
          await markGradeAsked(db, ev.id);
        }
      }

      await markEveningBriefingSent(db, userId);
    } catch (e) {
      console.warn('[Prof] Erreur checkEveningBriefing:', e);
    }
  };

  const checkReviewProposal = async () => {
    try {
      const profile = getLocalProfile();
      if (!profile) return;
      const userId = profile.code ?? 'default';
      const db = await openProfDatabase();
      const canOffer = await canOfferReviewToday(db, userId);
      if (!canOffer) return;
      const topics = await getTopicsToReview(db, userId);
      if (topics.length === 0) return;
      await markReviewOffered(db, userId);
      const topicsText = formatTopicsToReview(topics);
      const enrichedPrompt = `${PROF_REVIEW_PROMPT}\n\n${getDateContext()}\n\n${topicsText}`;
      const apiMessages: ApiMessage[] = [{
        role: 'user',
        content: '[SYSTEME] Tu viens de recevoir des notions à revoir. Propose spontanément une révision (message court).',
      }];
      const result = await sendMessageToAgent({
        messages: apiMessages,
        agentSystemPrompt: enrichedPrompt,
        enableTools: false,
        agentId: 'prof',
      });
      if (!isMounted.current) return;
      if (!result.reply) return;
      const proposedMessage: ChatMessage = {
        id: `agent-review-${Date.now()}`,
        text: result.reply,
        isUser: false,
      };
      setMessages((prev) => [...prev, proposedMessage]);
      saveMessage({ id: proposedMessage.id, agentId: 'prof', text: proposedMessage.text, isUser: false });
    } catch (e) {
      console.warn('[Prof] Erreur proposition révision:', e);
    }
  };

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
      const newQuestions = questions.filter((q) => !prev.some((m) => m.text === q.text));
      if (newQuestions.length === 0) return prev;
      newQuestions.forEach((q) => {
        saveMessage({ id: q.id, agentId: 'sante', text: q.text, isUser: false });
      });
      return [...prev, ...newQuestions];
    });
  };

  // ============================================================
  // EXECUTION UNIVERSELLE DES TOOLS
  // ============================================================

  const executeToolCall = async (call: ToolCall, agentId: string): Promise<string> => {
    const args = call.arguments as any;
    console.log('🔧 Exécution du tool:', call.name, args);

    try {
      const profDb = await openProfDatabase();
      const profile = getLocalProfile();
      const userId = profile?.code ?? 'default';

      if (call.name === 'startQuiz') {
        const title = args.title || 'Quiz';
        const questions = args.questions || [];
        if (!questions.length) return 'Aucune question fournie.';
        return `__QUIZ__:${JSON.stringify({ title, questions })}`;
      }

      if (call.name === 'startDictation') {
        const sentences: string[] = args.sentences || [];
        if (!sentences.length) return 'Aucune phrase fournie.';
        return `__DICTATION__:${sentences.join('\n')}`;
      }

      if (call.name === 'generateVisual') {
        const type = args.type || 'svg';
        const title = args.title || 'Visuel';
        const code = args.code || '';
        if (!code) return 'Aucun code fourni.';
        return `__VISUAL__:${JSON.stringify({ type, title, code })}`;
      }

      if (call.name === 'createRevisionSheet') {
        const subject = args.subject || 'Général';
        const topic = args.topic || 'Fiche';
        const title = args.title || `Fiche : ${topic} — ${subject}`;
        const contentHtml = args.content_html || '';
        if (!contentHtml) return 'Aucun contenu HTML fourni.';

        const docId = `sheet-${Date.now()}`;
        saveDocument({
          id: docId,
          agentId,
          title,
          content: contentHtml,
        });

        const confirmationMessage = `📄 Ta fiche de révision est prête : "${title}"\n\nTu la retrouveras dans ta bibliothèque (icône 📚 en haut).`;
        const confirmationMsg: ChatMessage = {
          id: `agent-sheet-${Date.now()}`,
          text: confirmationMessage,
          isUser: false,
        };
        setMessages((prev) => [...prev, confirmationMsg]);
        saveMessage({
          id: confirmationMsg.id,
          agentId,
          text: confirmationMsg.text,
          isUser: false,
        });

        return `Fiche enregistrée : ${title}`;
      }

      if (call.name === 'listGrades') {
        const events = await getEventsWithGrades(profDb, userId);
        if (events.length === 0) {
          return 'Aucune note enregistrée pour cet enfant pour le moment.';
        }
        const lines: string[] = ['Notes enregistrées :', ''];
        const bySubject: Record<string, any[]> = {};
        for (const e of events) {
          const subject = e.subject || 'Autre';
          if (!bySubject[subject]) bySubject[subject] = [];
          bySubject[subject].push(e);
        }
        for (const [subject, list] of Object.entries(bySubject)) {
          let totalPoints = 0;
          let totalMax = 0;
          for (const e of list) {
            if (e.grade !== null && e.grade_max) {
              totalPoints += e.grade;
              totalMax += e.grade_max;
            }
          }
          const moyenne = totalMax > 0 ? (totalPoints / totalMax) * 20 : 0;
          lines.push(`${subject} (${list.length} note${list.length > 1 ? 's' : ''}, moyenne ${moyenne.toFixed(1)}/20) :`);
          for (const e of list) {
            lines.push(`  - ${e.grade}/${e.grade_max} (${e.title})`);
          }
        }
        return lines.join('\n');
      }

      if (call.name === 'getSchedule') {
        const schedule = await getSchedule(profDb, userId);
        if (schedule.length === 0) return 'Aucun emploi du temps enregistré.';
        const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        const lines: string[] = ['Emploi du temps :', ''];
        const byDay: Record<number, any[]> = {};
        for (const item of schedule) {
          if (!byDay[item.day_of_week]) byDay[item.day_of_week] = [];
          byDay[item.day_of_week].push(item);
        }
        for (const [day, items] of Object.entries(byDay)) {
          lines.push(`${dayNames[parseInt(day)]} :`);
          for (const item of items) {
            lines.push(`  - ${item.start_time}-${item.end_time} : ${item.subject}`);
          }
        }
        return lines.join('\n');
      }

      if (call.name === 'getWeather') {
        const city = args.city || (await getProfProfile(profDb, userId))?.weather_city;
        if (!city) {
          return 'Aucune ville renseignée. Demande à l\'enfant dans quelle ville il habite.';
        }
        const weather = await fetchWeather(profDb, userId, city, true);
        if (!weather) {
          return `Impossible de récupérer la météo pour ${city}.`;
        }
        return formatWeatherForPrompt(weather);
      }

      if (call.name === 'updateWeatherCity') {
        const city = args.city?.trim();
        if (city) {
          await setWeatherCity(profDb, userId, city);
          return `Ville mise à jour : ${city}`;
        }
        return 'Aucune ville fournie.';
      }

      if (call.name === 'saveGrade') {
        const grade = parseFloat(args.grade);
        const gradeMax = parseFloat(args.grade_max);
        if (isNaN(grade) || isNaN(gradeMax)) {
          return 'Note invalide.';
        }
        const eventId = parseInt(args.eventId);
        if (!isNaN(eventId) && eventId > 0) {
          await saveEventGrade(profDb, eventId, grade, gradeMax);
          return `Note enregistrée : ${grade}/${gradeMax}`;
        } else {
          await addProfEvent(profDb, {
            user_id: userId,
            type: 'controle',
            subject: args.subject || 'Matière inconnue',
            title: args.title || 'Contrôle',
            due_date: Date.now() - 3 * 24 * 60 * 60 * 1000,
            done: 1,
          });
          const allEvents = await getEventsWithGrades(profDb, userId);
          const lastEvent = allEvents[0];
          if (lastEvent && lastEvent.id !== undefined) {
            await saveEventGrade(profDb, lastEvent.id, grade, gradeMax);
          }
          return `Note enregistrée : ${grade}/${gradeMax}`;
        }
      }

      if (call.name === 'saveTopicProgress') {
        await saveTopicProgress(profDb, userId, args.subject, args.topic, args.result);
        return `Notion enregistrée : ${args.subject} - ${args.topic} (${args.result})`;
      }

      if (call.name === 'saveProfEvent') {
        const dueDate = new Date(args.due_date);
        if (!isNaN(dueDate.getTime())) {
          await addProfEvent(profDb, {
            user_id: userId,
            type: args.type,
            subject: args.subject,
            title: args.title,
            due_date: dueDate.getTime(),
          });
          return `Événement enregistré : ${args.title} le ${dueDate.toLocaleDateString('fr-FR')}`;
        }
        return 'Date invalide.';
      }

      if (call.name === 'saveScheduleFromImage') {
        await clearSchedule(profDb, userId);
        for (const item of args.items) {
          await addScheduleItem(profDb, {
            user_id: userId,
            day_of_week: item.day_of_week,
            start_time: item.start_time,
            end_time: item.end_time,
            subject: item.subject,
            room: item.room,
            teacher: item.teacher,
          });
        }
        try {
          const state = await getProfState(profDb, userId);
          if (!state.morning_briefing_enabled) {
            await scheduleMorningBriefing(profDb, userId, 7, 30);
          }
          if (!state.evening_briefing_enabled) {
            const profileFull = await getProfProfile(profDb, userId);
            const level = profileFull?.child_level ?? null;
            const { hour, minute } = getDefaultEveningHour(level);
            await scheduleEveningBriefing(profDb, userId, hour, minute);
          }
        } catch (e) { console.warn('[Prof] Planification briefings:', e); }
        return `Emploi du temps enregistré : ${args.items.length} cours`;
      }

      if (call.name === 'updateEveningBriefing') {
        await updateEveningBriefingTime(profDb, userId, args.hour, args.minute);
        await scheduleEveningBriefing(profDb, userId, args.hour, args.minute);
        return `Rappel du soir modifié à ${args.hour}h${args.minute.toString().padStart(2, '0')}`;
      }

      if (call.name === 'toggleEveningBriefing') {
        if (args.enabled) {
          const state = await getProfState(profDb, userId);
          await scheduleEveningBriefing(profDb, userId, state.evening_briefing_hour, state.evening_briefing_minute);
          return 'Rappel du soir activé';
        } else {
          await cancelEveningBriefing(profDb, userId);
          return 'Rappel du soir désactivé';
        }
      }

      if (call.name === 'createDocument') {
        const docId = `doc-${Date.now()}`;
        saveDocument({ id: docId, agentId, title: args.title, content: args.content });
        return `Document créé : ${args.title}`;
      }

      if (call.name === 'createDailyReminders') {
        const times: string[] = args.times || [];
        if (times.length === 0) return 'Aucun horaire fourni.';
        const baseId = `reminder-${Date.now()}`;
        const results = await scheduleMultipleDailyReminders({ medicationName: args.medicationName, times, baseId });
        results.forEach((r) => {
          saveReminder({ id: r.reminderId, agentId, medicationName: args.medicationName, time: r.time, notificationId: r.notificationId, reminderType: 'daily' });
        });
        return `Rappels créés : ${results.length} à ${times.join(', ')}`;
      }

      if (call.name === 'createOneTimeReminders') {
        const dateTimes: string[] = args.dateTimes || [];
        if (dateTimes.length === 0) return 'Aucune date fournie.';
        const baseId = `reminder-${Date.now()}`;
        const results = await scheduleMultipleOneTimeReminders({ medicationName: args.medicationName, dateTimes, baseId });
        results.forEach((r) => {
          const date = new Date(r.scheduledAt);
          const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          saveReminder({ id: r.reminderId, agentId, medicationName: args.medicationName, time: timeStr, notificationId: r.notificationId, reminderType: 'onetime', scheduledAt: r.scheduledAt });
        });
        return `Rappels créés : ${results.length}`;
      }

      if (call.name === 'createRelativeReminder') {
        const reminderId = `reminder-${Date.now()}`;
        const { notificationId, scheduledAt } = await scheduleRelativeReminder({
          medicationName: args.medicationName,
          minutesFromNow: args.minutesFromNow,
          reminderId,
        });
        if (notificationId && scheduledAt) {
          const date = new Date(scheduledAt);
          const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          saveReminder({ id: reminderId, agentId, medicationName: args.medicationName, time: timeStr, notificationId, reminderType: 'relative', scheduledAt });
          return `Rappel créé dans ${args.minutesFromNow} minutes`;
        }
        return 'Impossible de créer le rappel.';
      }

      if (call.name === 'saveUserPreference') {
        savePreference(args.preferenceKey, args.preferenceValue);
        return `Préférence enregistrée : ${args.preferenceKey}`;
      }

      if (call.name === 'cancelReminders') {
        if (args.medicationName) {
          deactivateRemindersByName(agentId, args.medicationName);
          return `Rappels annulés pour ${args.medicationName}`;
        } else {
          deactivateAllReminders(agentId);
          return 'Tous les rappels annulés';
        }
      }

      if (call.name === 'deleteReminder') {
        const name = args.name || args.medicationName || '';
        if (!name) {
          return 'Nom du rappel manquant.';
        }
        deactivateRemindersByName(agentId, name);
        return `Rappel supprimé : "${name}"`;
      }

      if (call.name === 'listReminders') {
        const reminders = loadReminders(agentId);
        if (reminders.length === 0) return 'Aucun rappel actif.';
        const list = reminders.map((r) => `- ${r.medication_name} à ${r.time.replace(':', 'h')}`).join('\n');
        return `Rappels actifs :\n${list}`;
      }

      return 'Tool non reconnu : ' + call.name;
    } catch (e) {
      console.warn('[Prof] Erreur execution tool:', e);
      return 'Erreur lors de l\'exécution du tool.';
    }
  };

  const selectedAgent = AGENTS.find((a) => a.id === selectedAgentId);
  const headerTitle = selectedAgent ? selectedAgent.name : 'Aucun agent';

  const handleSend = async (text: string) => {
    console.log('🚀 handleSend appelé avec:', text);

    if (!selectedAgent) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, text, isUser: true };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    saveMessage({ id: userMessage.id, agentId: selectedAgent.id, text: userMessage.text, isUser: true });

    if (selectedAgent.id === 'sante') {
      const remindersToAsk = findRemindersToAsk('sante');
      if (remindersToAsk.length > 0) {
        const lower = text.toLowerCase();
        const first = remindersToAsk[0];
        if (lower.includes('oui') || lower.includes('pris')) setReminderResponse(first.id, 'taken');
        else if (lower.includes('non') || lower.includes('pas')) setReminderResponse(first.id, 'not_taken');
        else if (lower.includes('plus tard') || lower.includes('attends')) setReminderResponse(first.id, 'later');
      }
    }

    setIsLoading(true);
    console.log('🟡 isLoading mis à true');

    try {
      let systemPrompt = selectedAgent.systemPrompt;
      systemPrompt = `${systemPrompt}\n\n${getDateContext()}`;

      // 🆕 BILAN : on appelle getActivityReport EN LOCAL et on injecte les données
      if (selectedAgent.id === 'prof' && isBilanRequest(text)) {
        try {
          const profDb = await openProfDatabase();
          const profile = getLocalProfile();
          const userId = profile?.code ?? 'default';

          // Détecte la période (7 jours / 30 jours / 365 jours)
          const lower = text.toLowerCase();
          let days = 30;
          if (lower.includes('semaine')) days = 7;
          else if (lower.includes('mois')) days = 30;
          else if (lower.includes('toujours') || lower.includes('toujours')) days = 365;

          console.log('📊 Bilan demandé — période :', days, 'jours');

          const reportText = await buildActivityReportText(userId, days);
          systemPrompt = `${systemPrompt}\n\n${reportText}`;
        } catch (e) {
          console.warn('[Prof] bilan:', e);
        }
      }

      if (selectedAgent.id === 'prof' && isGradesRequest(text)) {
        try {
          const profDb = await openProfDatabase();
          const profile = getLocalProfile();
          const userId = profile?.code ?? 'default';
          const eventsWithGrades = await getEventsWithGrades(profDb, userId);
          const gradesText = formatGradesForPrompt(eventsWithGrades);
          systemPrompt = `${systemPrompt}\n\n${gradesText}`;
        } catch (e) { console.warn('[Prof] notes:', e); }
      }

      if (selectedAgent.id === 'prof') {
        const detectedGrade = extractGradeFromMessage(text);
        if (detectedGrade) {
          try {
            const profDb = await openProfDatabase();
            const profile = getLocalProfile();
            const userId = profile?.code ?? 'default';
            const pendingGrades = await getEventsAwaitingGrade(profDb, userId);
            const contextText = formatPendingGradesContext(pendingGrades, detectedGrade);

            if (contextText) {
              systemPrompt = `${systemPrompt}\n\n${contextText}`;
            } else {
              const subject = extractSubjectFromGradeMessage(text) || 'Matière inconnue';
              systemPrompt = `${systemPrompt}\n\n## NOTE DONNÉE PAR L'ENFANT\n\nL'enfant vient de donner une note : **${detectedGrade.grade}/${detectedGrade.gradeMax}** en ${subject}.\n\n👉 Tu DOIS appeler le tool \`saveGrade\` avec :\n- eventId: 0\n- subject: "${subject}"\n- title: "Contrôle"\n- grade: ${detectedGrade.grade}\n- grade_max: ${detectedGrade.gradeMax}\n\nPuis félicite ou encourage.`;
            }
          } catch (e) { console.warn('[Prof] détection note:', e); }
        }
      }

      if (selectedAgent.id === 'prof' && isScheduleQuestion(text)) {
        try {
          const profDb = await openProfDatabase();
          const profile = getLocalProfile();
          const userId = profile?.code ?? 'default';
          const schedule = await getSchedule(profDb, userId);
          const scheduleText = formatScheduleForPrompt(schedule);
          systemPrompt = `${systemPrompt}\n\n${scheduleText}`;
        } catch (e) { console.warn('[Prof] emploi du temps:', e); }
      }

      if (selectedAgent.id === 'prof' && isWeatherQuestion(text)) {
        try {
          const profDb = await openProfDatabase();
          const profile = getLocalProfile();
          const userId = profile?.code ?? 'default';
          const fullProfile = await getProfProfile(profDb, userId);

          const specificCity = extractCityFromMessage(text);
          const cityToUse = specificCity || fullProfile?.weather_city;

          if (cityToUse) {
            const weather = await fetchWeather(profDb, userId, cityToUse, !!specificCity);
            if (weather) {
              const weatherText = formatWeatherForPrompt(weather);
              systemPrompt = `${systemPrompt}\n\n${weatherText}`;
            }
          } else {
            systemPrompt = `${systemPrompt}\n\n## DONNÉES MÉTÉO\n\nAucune ville enregistrée. Demande gentiment à l'enfant dans quelle ville il habite.`;
          }
        } catch (e) { console.warn('[Prof] météo:', e); }
      }

      if (selectedAgent.id === 'prof') {
        const newCity = extractCityChangeFromMessage(text);
        if (newCity) {
          try {
            const profDb = await openProfDatabase();
            const profile = getLocalProfile();
            const userId = profile?.code ?? 'default';
            await setWeatherCity(profDb, userId, newCity);
          } catch (e) { console.warn('[Prof] update city:', e); }
        }
      }

      const apiMessages: ApiMessage[] = newMessages.map((m) => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.text,
      }));

      console.log('📤 Envoi à Prof...');

      const result = await sendMessageToAgent({
        messages: apiMessages,
        agentSystemPrompt: systemPrompt,
        enableTools: (selectedAgent as any).enableTools === true,
        agentId: selectedAgent.id,
      });

      console.log('📥 Réponse reçue:', result.reply?.substring(0, 50), '| ToolCalls:', result.toolCalls?.length);

      if (!isMounted.current) return;

      let currentResult = result;
      let loopCount = 0;
      let messageAlreadyDisplayed = false;
      const MAX_LOOPS = 3;

      while (
        currentResult.toolCalls &&
        currentResult.toolCalls.length > 0 &&
        loopCount < MAX_LOOPS
      ) {
        loopCount++;
        console.log(`🔁 Boucle tool calling #${loopCount} — ${currentResult.toolCalls.length} tool(s)`);

        const allToolCalls = currentResult.toolCalls;
        const allToolResults: string[] = [];
        for (const tool of allToolCalls) {
          const res = await executeToolCall(tool, selectedAgent.id);
          allToolResults.push(res);
        }

        const newResult = await sendToolResultsToAgent({
          messages: apiMessages,
          toolCalls: allToolCalls,
          toolResults: allToolResults,
          agentSystemPrompt: systemPrompt,
          agentId: selectedAgent.id,
        });

        console.log(`📥 Réponse boucle #${loopCount}:`, newResult.reply?.substring(0, 50));

        const quizResult = findToolResult(allToolResults, '__QUIZ__:');
        if (quizResult) {
          const jsonStr = quizResult.replace('__QUIZ__:', '');
          let quizData: { title: string; questions: any[] } | null = null;
          try {
            quizData = JSON.parse(jsonStr);
          } catch (e) {
            console.warn('[Prof] Erreur parsing quiz:', e);
          }

          if (quizData) {
            const quizMessage: ChatMessage = {
              id: `agent-quiz-${Date.now()}`,
              text: '',
              isUser: false,
              isQuiz: true,
              quizTitle: quizData.title,
              quizQuestions: quizData.questions,
            };
            setMessages((prev) => [...prev, quizMessage]);
            saveMessage({ id: quizMessage.id, agentId: selectedAgent.id, text: `[QUIZ] ${quizData.title}`, isUser: false });
            messageAlreadyDisplayed = true;
          }

          if (newResult.reply && newResult.reply.trim().length > 0) {
            const finalMessage: ChatMessage = { id: `agent-${Date.now()}`, text: newResult.reply, isUser: false };
            setMessages((prev) => [...prev, finalMessage]);
            saveMessage({ id: finalMessage.id, agentId: selectedAgent.id, text: finalMessage.text, isUser: false });
          }
          currentResult = newResult;
          break;
        }

        const dictResult = findToolResult(allToolResults, '__DICTATION__:');
        if (dictResult) {
          const sentences = dictResult.replace('__DICTATION__:', '');
          const dictationMessage: ChatMessage = {
            id: `agent-dictation-${Date.now()}`,
            text: sentences,
            isUser: false,
            isDictation: true,
          };
          setMessages((prev) => [...prev, dictationMessage]);
          saveMessage({ id: dictationMessage.id, agentId: selectedAgent.id, text: dictationMessage.text, isUser: false });
          messageAlreadyDisplayed = true;

          if (newResult.reply && newResult.reply.trim().length > 0) {
            const finalMessage: ChatMessage = { id: `agent-${Date.now()}`, text: newResult.reply, isUser: false };
            setMessages((prev) => [...prev, finalMessage]);
            saveMessage({ id: finalMessage.id, agentId: selectedAgent.id, text: finalMessage.text, isUser: false });
          }
          currentResult = newResult;
          break;
        }

        const visualResult = findToolResult(allToolResults, '__VISUAL__:');
        if (visualResult) {
          const jsonStr = visualResult.replace('__VISUAL__:', '');
          let visualData: VisualData | null = null;
          try {
            visualData = JSON.parse(jsonStr);
          } catch (e) {
            console.warn('[Prof] Erreur parsing visual:', e);
          }

          if (visualData) {
            const visualMessage: ChatMessage = {
              id: `agent-visual-${Date.now()}`,
              text: newResult.reply || '',
              isUser: false,
              visual: visualData,
            };
            setMessages((prev) => [...prev, visualMessage]);
            saveMessage({ id: visualMessage.id, agentId: selectedAgent.id, text: '', isUser: false });
            messageAlreadyDisplayed = true;
          }
          currentResult = newResult;
          break;
        }

        if (newResult.reply && newResult.reply.trim().length > 0) {
          const finalMessage: ChatMessage = { id: `agent-${Date.now()}`, text: newResult.reply, isUser: false };
          setMessages((prev) => [...prev, finalMessage]);
          saveMessage({ id: finalMessage.id, agentId: selectedAgent.id, text: finalMessage.text, isUser: false });
          messageAlreadyDisplayed = true;
          currentResult = newResult;
          break;
        }

        currentResult = newResult;
      }

      if (!messageAlreadyDisplayed) {
        if (!currentResult.reply || currentResult.reply.trim().length === 0) {
          const fallbackMessage: ChatMessage = {
            id: `agent-${Date.now()}`,
            text: 'Je n\'ai pas réussi à formuler une réponse. Réessaie avec un autre message 😅',
            isUser: false,
            isError: true,
            originalText: text,
          };
          setMessages((prev) => [...prev, fallbackMessage]);
          saveMessage({ id: fallbackMessage.id, agentId: selectedAgent.id, text: fallbackMessage.text, isUser: false });
        } else if (!currentResult.toolCalls || currentResult.toolCalls.length === 0) {
          const agentMessage: ChatMessage = {
            id: `agent-${Date.now()}`,
            text: currentResult.reply,
            isUser: false,
          };
          setMessages((prev) => [...prev, agentMessage]);
          saveMessage({ id: agentMessage.id, agentId: selectedAgent.id, text: agentMessage.text, isUser: false });
        }
      }
    } catch (error) {
      if (!isMounted.current) return;
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        text: `Erreur : ${error instanceof Error ? error.message : 'inconnue'}`,
        isUser: false,
        isError: true,
        originalText: text,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      console.log('🔴 finally atteint');
      if (isMounted.current) setIsLoading(false);
    }
  };

  const handleRetry = async (originalText: string) => {
    setMessages((prev) => prev.filter((m) => !(m.isError && m.originalText === originalText)));
    await handleSend(originalText);
  };

  const handleStopQuiz = async (messageId: string) => {
    if (!selectedAgent) return;

    const prompt = `[SYSTEME] L'enfant a arrêté le quiz volontairement. Réagis gentiment, sans juger. Propose-lui autre chose (autre quiz, dictée, révision, discussion). Sois bref.`;

    try {
      const result = await sendMessageToAgent({
        messages: [{ role: 'user', content: prompt }],
        agentSystemPrompt: selectedAgent.systemPrompt,
        enableTools: false,
        agentId: selectedAgent.id,
      });

      if (!isMounted.current) return;

      if (result.reply && result.reply.trim().length > 0) {
        const finalMessage: ChatMessage = {
          id: `agent-stop-quiz-${Date.now()}`,
          text: result.reply,
          isUser: false,
        };
        setMessages((prev) => [...prev, finalMessage]);
        saveMessage({ id: finalMessage.id, agentId: selectedAgent.id, text: finalMessage.text, isUser: false });
      }
    } catch (e) {
      console.warn('[Quiz] Erreur arrêt:', e);
    }
  };

  const handleFilePicked = (file: ImportedFile) => {
    setPendingFile(file);
    setFileModalVisible(true);
  };

  const handleFileSend = async (message: string, action: FileAction) => {
    setFileModalVisible(false);
    if (!pendingFile || !selectedAgent) return;

    if (action === 'save') {
      const docId = `doc-file-${Date.now()}`;
      const savedPath = await saveFileToDocuments(pendingFile.uri, pendingFile.fileName);
      saveDocument({ id: docId, agentId: selectedAgent.id, title: pendingFile.title, content: '', filePath: savedPath || undefined, fileType: pendingFile.mimeType });
      Alert.alert('Enregistré !', `"${pendingFile.title}" est dans ta bibliothèque.`);
      setPendingFile(null);
      return;
    }

    if (action === 'agent+save') {
      const docId = `doc-file-${Date.now()}`;
      const savedPath = await saveFileToDocuments(pendingFile.uri, pendingFile.fileName);
      saveDocument({ id: docId, agentId: selectedAgent.id, title: pendingFile.title, content: message || '', filePath: savedPath || undefined, fileType: pendingFile.mimeType });
    }

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
    saveMessage({ id: userMessage.id, agentId: selectedAgent.id, text: userMessage.text, isUser: true });

    setIsLoading(true);

    try {
      let content: any = userText;
      if (isImage && pendingFile.base64) {
        content = [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: `data:${pendingFile.mimeType};base64,${pendingFile.base64}` } },
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

      const systemPromptWithDate = `${selectedAgent.systemPrompt}\n\n${getDateContext()}`;

      const result = await sendMessageToAgent({
        messages: apiMessages,
        agentSystemPrompt: systemPromptWithDate,
        enableTools: (selectedAgent as any).enableTools === true,
        agentId: selectedAgent.id,
      });

      if (!isMounted.current) return;

      let currentResult = result;
      let loopCount = 0;
      let messageAlreadyDisplayed = false;
      const MAX_LOOPS = 3;

      while (currentResult.toolCalls && currentResult.toolCalls.length > 0 && loopCount < MAX_LOOPS) {
        loopCount++;

        const allToolCalls = currentResult.toolCalls;
        const allToolResults: string[] = [];
        for (const tool of allToolCalls) {
          const res = await executeToolCall(tool, selectedAgent.id);
          allToolResults.push(res);
        }

        const newResult = await sendToolResultsToAgent({
          messages: apiMessages,
          toolCalls: allToolCalls,
          toolResults: allToolResults,
          agentSystemPrompt: systemPromptWithDate,
          agentId: selectedAgent.id,
        });

        const quizResult = findToolResult(allToolResults, '__QUIZ__:');
        if (quizResult) {
          const jsonStr = quizResult.replace('__QUIZ__:', '');
          try {
            const quizData = JSON.parse(jsonStr);
            const quizMessage: ChatMessage = {
              id: `agent-quiz-${Date.now()}`,
              text: '',
              isUser: false,
              isQuiz: true,
              quizTitle: quizData.title,
              quizQuestions: quizData.questions,
            };
            setMessages((prev) => [...prev, quizMessage]);
            saveMessage({ id: quizMessage.id, agentId: selectedAgent.id, text: `[QUIZ] ${quizData.title}`, isUser: false });
            messageAlreadyDisplayed = true;
          } catch (e) { console.warn('[Prof] Parsing quiz:', e); }
          if (newResult.reply && newResult.reply.trim().length > 0) {
            const finalMessage: ChatMessage = { id: `agent-${Date.now()}`, text: newResult.reply, isUser: false };
            setMessages((prev) => [...prev, finalMessage]);
            saveMessage({ id: finalMessage.id, agentId: selectedAgent.id, text: finalMessage.text, isUser: false });
          }
          currentResult = newResult;
          break;
        }

        const dictResult = findToolResult(allToolResults, '__DICTATION__:');
        if (dictResult) {
          const sentences = dictResult.replace('__DICTATION__:', '');
          const dictationMessage: ChatMessage = {
            id: `agent-dictation-${Date.now()}`,
            text: sentences,
            isUser: false,
            isDictation: true,
          };
          setMessages((prev) => [...prev, dictationMessage]);
          saveMessage({ id: dictationMessage.id, agentId: selectedAgent.id, text: dictationMessage.text, isUser: false });
          messageAlreadyDisplayed = true;
          if (newResult.reply && newResult.reply.trim().length > 0) {
            const finalMessage: ChatMessage = { id: `agent-${Date.now()}`, text: newResult.reply, isUser: false };
            setMessages((prev) => [...prev, finalMessage]);
            saveMessage({ id: finalMessage.id, agentId: selectedAgent.id, text: finalMessage.text, isUser: false });
          }
          currentResult = newResult;
          break;
        }

        const visualResult = findToolResult(allToolResults, '__VISUAL__:');
        if (visualResult) {
          const jsonStr = visualResult.replace('__VISUAL__:', '');
          try {
            const visualData = JSON.parse(jsonStr);
            const visualMessage: ChatMessage = {
              id: `agent-visual-${Date.now()}`,
              text: newResult.reply || '',
              isUser: false,
              visual: visualData,
            };
            setMessages((prev) => [...prev, visualMessage]);
            saveMessage({ id: visualMessage.id, agentId: selectedAgent.id, text: '', isUser: false });
            messageAlreadyDisplayed = true;
          } catch (e) { console.warn('[Prof] Parsing visual:', e); }
          currentResult = newResult;
          break;
        }

        if (newResult.reply && newResult.reply.trim().length > 0) {
          const finalMessage: ChatMessage = { id: `agent-${Date.now()}`, text: newResult.reply, isUser: false };
          setMessages((prev) => [...prev, finalMessage]);
          saveMessage({ id: finalMessage.id, agentId: selectedAgent.id, text: finalMessage.text, isUser: false });
          messageAlreadyDisplayed = true;
          currentResult = newResult;
          break;
        }
        currentResult = newResult;
      }

      if (!messageAlreadyDisplayed) {
        if (!currentResult.reply || currentResult.reply.trim().length === 0) {
          const fallbackMessage: ChatMessage = {
            id: `agent-${Date.now()}`,
            text: 'Je n\'ai pas réussi à formuler une réponse. Réessaie 😅',
            isUser: false,
            isError: true,
            originalText: userText,
          };
          setMessages((prev) => [...prev, fallbackMessage]);
          saveMessage({ id: fallbackMessage.id, agentId: selectedAgent.id, text: fallbackMessage.text, isUser: false });
        } else if (!currentResult.toolCalls || currentResult.toolCalls.length === 0) {
          const agentMessage: ChatMessage = {
            id: `agent-${Date.now()}`,
            text: currentResult.reply,
            isUser: false,
          };
          setMessages((prev) => [...prev, agentMessage]);
          saveMessage({ id: agentMessage.id, agentId: selectedAgent.id, text: agentMessage.text, isUser: false });
        }
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        text: `Erreur : ${error instanceof Error ? error.message : 'inconnue'}`,
        isUser: false,
        isError: true,
        originalText: message || pendingFile.fileName,
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

    if (action === 'save') {
      const docId = `doc-photo-${Date.now()}`;
      const fileName = `photo_${Date.now()}.jpg`;
      const savedPath = await saveFileToDocuments(pendingPhoto.uri, fileName);
      saveDocument({ id: docId, agentId: selectedAgent.id, title: `Photo du ${new Date().toLocaleDateString('fr-FR')}`, content: '', filePath: savedPath || undefined, fileType: 'image/jpeg' });
      Alert.alert('Enregistré !', 'Photo enregistrée dans ta bibliothèque.');
      setPendingPhoto(null);
      return;
    }

    if (action === 'agent+save') {
      const docId = `doc-photo-${Date.now()}`;
      const fileName = `photo_${Date.now()}.jpg`;
      const savedPath = await saveFileToDocuments(pendingPhoto.uri, fileName);
      saveDocument({ id: docId, agentId: selectedAgent.id, title: `Photo du ${new Date().toLocaleDateString('fr-FR')}`, content: message || '', filePath: savedPath || undefined, fileType: 'image/jpeg' });
    }

    const userText = message || 'Analyse cette image';
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: message ? `📷 ${message}` : '📷 [Photo envoyée]',
      isUser: true,
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    saveMessage({ id: userMessage.id, agentId: selectedAgent.id, text: userMessage.text, isUser: true });

    setIsLoading(true);

    try {
      const content: any = pendingPhoto.base64
        ? [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${pendingPhoto.base64}` } },
          ]
        : `[Photo envoyée sans message]`;

      const apiMessages: ApiMessage[] = [
        ...newMessages.slice(0, -1).map((m) => ({
          role: m.isUser ? ('user' as const) : ('assistant' as const),
          content: m.text,
        })),
        { role: 'user', content },
      ];

      const systemPromptWithDate = `${selectedAgent.systemPrompt}\n\n${getDateContext()}`;

      const result = await sendMessageToAgent({
        messages: apiMessages,
        agentSystemPrompt: systemPromptWithDate,
        enableTools: (selectedAgent as any).enableTools === true,
        agentId: selectedAgent.id,
      });

      if (!isMounted.current) return;

      let currentResult = result;
      let loopCount = 0;
      let messageAlreadyDisplayed = false;
      const MAX_LOOPS = 3;

      while (currentResult.toolCalls && currentResult.toolCalls.length > 0 && loopCount < MAX_LOOPS) {
        loopCount++;

        const allToolCalls = currentResult.toolCalls;
        const allToolResults: string[] = [];
        for (const tool of allToolCalls) {
          const res = await executeToolCall(tool, selectedAgent.id);
          allToolResults.push(res);
        }

        const newResult = await sendToolResultsToAgent({
          messages: apiMessages,
          toolCalls: allToolCalls,
          toolResults: allToolResults,
          agentSystemPrompt: systemPromptWithDate,
          agentId: selectedAgent.id,
        });

        const quizResult = findToolResult(allToolResults, '__QUIZ__:');
        if (quizResult) {
          const jsonStr = quizResult.replace('__QUIZ__:', '');
          try {
            const quizData = JSON.parse(jsonStr);
            const quizMessage: ChatMessage = {
              id: `agent-quiz-${Date.now()}`,
              text: '',
              isUser: false,
              isQuiz: true,
              quizTitle: quizData.title,
              quizQuestions: quizData.questions,
            };
            setMessages((prev) => [...prev, quizMessage]);
            saveMessage({ id: quizMessage.id, agentId: selectedAgent.id, text: `[QUIZ] ${quizData.title}`, isUser: false });
            messageAlreadyDisplayed = true;
          } catch (e) { console.warn('[Prof] Parsing quiz:', e); }
          if (newResult.reply && newResult.reply.trim().length > 0) {
            const finalMessage: ChatMessage = { id: `agent-${Date.now()}`, text: newResult.reply, isUser: false };
            setMessages((prev) => [...prev, finalMessage]);
            saveMessage({ id: finalMessage.id, agentId: selectedAgent.id, text: finalMessage.text, isUser: false });
          }
          currentResult = newResult;
          break;
        }

        const dictResult = findToolResult(allToolResults, '__DICTATION__:');
        if (dictResult) {
          const sentences = dictResult.replace('__DICTATION__:', '');
          const dictationMessage: ChatMessage = {
            id: `agent-dictation-${Date.now()}`,
            text: sentences,
            isUser: false,
            isDictation: true,
          };
          setMessages((prev) => [...prev, dictationMessage]);
          saveMessage({ id: dictationMessage.id, agentId: selectedAgent.id, text: dictationMessage.text, isUser: false });
          messageAlreadyDisplayed = true;
          if (newResult.reply && newResult.reply.trim().length > 0) {
            const finalMessage: ChatMessage = { id: `agent-${Date.now()}`, text: newResult.reply, isUser: false };
            setMessages((prev) => [...prev, finalMessage]);
            saveMessage({ id: finalMessage.id, agentId: selectedAgent.id, text: finalMessage.text, isUser: false });
          }
          currentResult = newResult;
          break;
        }

        const visualResult = findToolResult(allToolResults, '__VISUAL__:');
        if (visualResult) {
          const jsonStr = visualResult.replace('__VISUAL__:', '');
          try {
            const visualData = JSON.parse(jsonStr);
            const visualMessage: ChatMessage = {
              id: `agent-visual-${Date.now()}`,
              text: newResult.reply || '',
              isUser: false,
              visual: visualData,
            };
            setMessages((prev) => [...prev, visualMessage]);
            saveMessage({ id: visualMessage.id, agentId: selectedAgent.id, text: '', isUser: false });
            messageAlreadyDisplayed = true;
          } catch (e) { console.warn('[Prof] Parsing visual:', e); }
          currentResult = newResult;
          break;
        }

        if (newResult.reply && newResult.reply.trim().length > 0) {
          const finalMessage: ChatMessage = { id: `agent-${Date.now()}`, text: newResult.reply, isUser: false };
          setMessages((prev) => [...prev, finalMessage]);
          saveMessage({ id: finalMessage.id, agentId: selectedAgent.id, text: finalMessage.text, isUser: false });
          messageAlreadyDisplayed = true;
          currentResult = newResult;
          break;
        }
        currentResult = newResult;
      }

      if (!messageAlreadyDisplayed) {
        if (!currentResult.reply || currentResult.reply.trim().length === 0) {
          const fallbackMessage: ChatMessage = {
            id: `agent-${Date.now()}`,
            text: 'Je n\'ai pas réussi à formuler une réponse. Réessaie 😅',
            isUser: false,
            isError: true,
            originalText: userText,
          };
          setMessages((prev) => [...prev, fallbackMessage]);
          saveMessage({ id: fallbackMessage.id, agentId: selectedAgent.id, text: fallbackMessage.text, isUser: false });
        } else if (!currentResult.toolCalls || currentResult.toolCalls.length === 0) {
          const agentMessage: ChatMessage = {
            id: `agent-${Date.now()}`,
            text: currentResult.reply,
            isUser: false,
          };
          setMessages((prev) => [...prev, agentMessage]);
          saveMessage({ id: agentMessage.id, agentId: selectedAgent.id, text: agentMessage.text, isUser: false });
        }
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        text: `Erreur : ${error instanceof Error ? error.message : 'inconnue'}`,
        isUser: false,
        isError: true,
        originalText: userText,
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

  const handleQuizAnswer = async (
    messageId: string,
    questionIndex: number,
    userAnswer: string
  ) => {
    console.log('[Quiz] Réponse:', { messageId, questionIndex, userAnswer });

    if (questionIndex === -1 && userAnswer.startsWith('STOP:')) {
      await handleStopQuiz(messageId);
      return;
    }

    if (questionIndex === -1 && userAnswer.startsWith('FIN:')) {
      const scorePart = userAnswer.replace('FIN:', '');
      const [correct, total] = scorePart.split('/');

      console.log(`🎉 Quiz terminé : ${correct}/${total}`);

      const quizMsg = messages.find((m) => m.id === messageId);
      const quizTitle = quizMsg?.quizTitle || 'Quiz';

      if (!selectedAgent) return;

      const congratsPrompt = `[SYSTEME] L'enfant vient de terminer le quiz "${quizTitle}" avec un score de ${correct}/${total}. Félicite-le chaleureusement, commente son score (sans juger), et propose-lui soit un nouveau quiz sur un autre thème, soit une autre activité (dictée, révision, exercice). Sois bref et chaleureux.`;

      try {
        const systemPromptWithDate = `${selectedAgent.systemPrompt}\n\n${getDateContext()}`;

        const result = await sendMessageToAgent({
          messages: [{ role: 'user', content: congratsPrompt }],
          agentSystemPrompt: systemPromptWithDate,
          enableTools: false,
          agentId: selectedAgent.id,
        });

        if (!isMounted.current) return;

        if (result.reply && result.reply.trim().length > 0) {
          const finalMessage: ChatMessage = {
            id: `agent-quiz-end-${Date.now()}`,
            text: result.reply,
            isUser: false,
          };
          setMessages((prev) => [...prev, finalMessage]);
          saveMessage({
            id: finalMessage.id,
            agentId: selectedAgent.id,
            text: finalMessage.text,
            isUser: false,
          });
        }
      } catch (e) {
        console.warn('[Quiz] Erreur félicitations:', e);
      }
    }
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
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <MessageList
          messages={messages}
          emptyText={emptyText}
          onQuizAnswer={handleQuizAnswer}
          onRetry={handleRetry}
        />
        <InputBar
          onSend={handleSend}
          onFilePicked={handleFilePicked}
          onPhotoTaken={handlePhotoTaken}
          disabled={!selectedAgent || isLoading}
          micDisabled={hasActiveQuiz(messages)}
          prefillText={prefillText}
          onPrefillConsumed={() => setPrefillText('')}
        />
      </KeyboardAvoidingView>
      <AgentMenu
        visible={agentMenuVisible}
        agents={AGENTS}
        selectedAgentId={selectedAgentId}
        onSelectAgent={(id) => { setSelectedAgentId(id); setAgentMenuVisible(false); }}
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

const EVENING_BRIEFING_PROMPT = `Tu es "Prof". Tu prépares ton rappel du soir pour l'enfant.
Tu viens de recevoir des données sur la journée de demain et éventuellement
des contrôles passés en attente de note.
Compose UN SEUL message court (3-5 lignes max), chaleureux, utile.
Tu choisis les informations les PLUS importantes. Tu ne listes pas tout.
Exemples :
- "Demain tu as un contrôle de Maths, tu veux qu'on révise 10 minutes ? 💪"
- "Pense à préparer tes affaires de sport pour demain 🎒"
- "Au fait, tu as eu ta note de Maths ? Tu peux me la dire ! 📝"`;

const PROF_REVIEW_PROMPT = `Tu es "Prof". Tu viens de recevoir des notions à revoir.
Propose spontanément une révision à l'enfant avec un message COURT (2-3 lignes max).
Ton chaleureux, léger, avec une porte de sortie ("tu veux ?").`;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  body: { flex: 1 },
});