// src/agents/prof/helpers.ts
// Fonctions utilitaires pour l'Agent Prof

import { type ProfScheduleItem, type ProfTopic } from './database';

/**
 * Détecte si un message contient un mot-clé "bilan" (demande du parent).
 */
export function isBilanRequest(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = [
    'bilan',
    'progrès',
    'progres',
    'résumé',
    'resume',
    'synthèse',
    'synthese',
    'où en est',
    'ou en est',
    'comment ça avance',
    'comment ca avance',
  ];
  return keywords.some((k) => lower.includes(k));
}

/**
 * Formate les données de progression pour injection dans le prompt.
 */
export function formatTopicsForPrompt(topics: ProfTopic[]): string {
  if (topics.length === 0) {
    return `## DONNÉES DE PROGRESSION

Aucune notion n'a encore été travaillée avec cet enfant.
Le bilan doit être bref et proposer de commencer les apprentissages.`;
  }

  const bySubject: Record<string, ProfTopic[]> = {};
  for (const t of topics) {
    if (!bySubject[t.subject]) bySubject[t.subject] = [];
    bySubject[t.subject].push(t);
  }

  const lines: string[] = ['## DONNÉES DE PROGRESSION', ''];

  for (const [subject, list] of Object.entries(bySubject)) {
    lines.push(`${subject} :`);
    for (const t of list) {
      const statusEmoji =
        t.status === 'acquired' ? '✅ acquis' :
        t.status === 'fragile' ? '⚠️ fragile' :
        '🔄 en cours';

      const daysSince = Math.floor((Date.now() - t.last_seen) / (24 * 60 * 60 * 1000));
      const timeLabel =
        daysSince === 0 ? "revu aujourd'hui" :
        daysSince === 1 ? 'revu hier' :
        daysSince < 7 ? `revu il y a ${daysSince} jours` :
        daysSince < 30 ? `revu il y a ${Math.floor(daysSince / 7)} semaine(s)` :
        `revu il y a ${Math.floor(daysSince / 30)} mois`;

      lines.push(`- ${t.topic} (${statusEmoji}, ${timeLabel})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formate les notions À REVOIR pour injection dans le prompt.
 */
export function formatTopicsToReview(topics: ProfTopic[]): string {
  if (topics.length === 0) return '';

  const lines: string[] = [
    '## NOTIONS À REVOIR AUJOURD\'HUI',
    '',
    'Ces notions doivent être proposées spontanément à l\'enfant (révisions espacées) :',
    '',
  ];

  for (const t of topics) {
    const daysSince = Math.floor((Date.now() - t.last_seen) / (24 * 60 * 60 * 1000));
    const statusLabel =
      t.status === 'fragile' ? '⚠️ fragile' :
      t.status === 'in_progress' ? '🔄 en cours' :
      '✅ acquis';

    lines.push(
      `- ${t.subject} : ${t.topic} (${statusLabel}, vue il y a ${daysSince} jours)`
    );
  }

  lines.push('');
  lines.push(
    '💡 Propose à l\'enfant de réviser la première notion de la liste, en commençant par quelque chose de simple et court.'
  );

  return lines.join('\n');
}

/**
 * 🆕 Formate l'emploi du temps pour injection dans le prompt.
 * Utilisé quand Prof doit consulter l'emploi du temps.
 */
export function formatScheduleForPrompt(items: ProfScheduleItem[]): string {
  if (items.length === 0) {
    return `## EMPLOI DU TEMPS

Aucun emploi du temps n'a encore été enregistré.
Demande gentiment à l'enfant de t'envoyer une photo de son emploi du temps.`;
  }

  const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const byDay: Record<number, ProfScheduleItem[]> = {};

  for (const item of items) {
    if (!byDay[item.day_of_week]) byDay[item.day_of_week] = [];
    byDay[item.day_of_week].push(item);
  }

  const lines: string[] = ['## EMPLOI DU TEMPS', ''];

  for (let day = 0; day <= 6; day++) {
    const dayItems = byDay[day];
    if (!dayItems || dayItems.length === 0) continue;

    lines.push(`${dayNames[day]} :`);
    const sorted = dayItems.sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (const item of sorted) {
      let line = `- ${item.start_time} - ${item.end_time} : ${item.subject}`;
      if (item.room) line += ` (salle ${item.room})`;
      if (item.teacher) line += ` avec ${item.teacher}`;
      lines.push(line);
    }
    lines.push('');
  }

  return lines.join('\n');
}