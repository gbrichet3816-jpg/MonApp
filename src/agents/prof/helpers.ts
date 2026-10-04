// src/agents/prof/helpers.ts
// Fonctions utilitaires pour l'Agent Prof

import {
  type ProfEvent,
  type ProfScheduleItem,
  type ProfTopic,
} from './database';

// ============================================================
// CONTEXTE TEMPOREL (🆕 bug #10)
// ============================================================

/**
 * Retourne un bloc de contexte avec la date et l'heure actuelles.
 * À injecter dans le prompt système de Prof pour qu'il connaisse "aujourd'hui".
 */
export function getDateContext(): string {
  const now = new Date();

  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeStr = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isoDate = now.toISOString().slice(0, 10);

  // Calcul de quelques repères utiles
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const inOneWeek = new Date(now);
  inOneWeek.setDate(inOneWeek.getDate() + 7);
  const inOneWeekStr = inOneWeek.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return `## CONTEXTE TEMPOREL

Nous sommes le **${dateStr}**, il est **${timeStr}**.
Date au format ISO : ${isoDate}
Demain : ${tomorrowStr}
Dans 7 jours : ${inOneWeekStr}

Utilise TOUJOURS cette date comme référence pour :
- Calculer les délais ("dans 3 jours", "la semaine prochaine")
- Situer les événements de l'agenda
- Adapter tes rappels et briefings
- Reformuler les dates relatives des messages de l'enfant`;
}

// ============================================================
// BILAN
// ============================================================

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

export function isGradesRequest(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = [
    'mes notes',
    'les notes',
    'bilan des notes',
    'bilan notes',
    'moyenne',
    'moyennes',
    'résultats scolaires',
    'resultats scolaires',
    'mes résultats',
    'mes resultats',
    'bulletin',
    'mes contrôles',
    'mes controles',
    'mes évaluations',
    'mes evaluations',
  ];
  return keywords.some((k) => lower.includes(k));
}

export function extractGradeFromMessage(
  text: string
): { grade: number; gradeMax: number } | null {
  const slashPattern = /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/;
  const slashMatch = text.match(slashPattern);
  if (slashMatch) {
    const grade = parseFloat(slashMatch[1].replace(',', '.'));
    const gradeMax = parseFloat(slashMatch[2].replace(',', '.'));
    if (!isNaN(grade) && !isNaN(gradeMax) && gradeMax > 0) {
      return { grade, gradeMax };
    }
  }

  const surPattern = /(\d+(?:[.,]\d+)?)\s+sur\s+(\d+(?:[.,]\d+)?)/i;
  const surMatch = text.match(surPattern);
  if (surMatch) {
    const grade = parseFloat(surMatch[1].replace(',', '.'));
    const gradeMax = parseFloat(surMatch[2].replace(',', '.'));
    if (!isNaN(grade) && !isNaN(gradeMax) && gradeMax > 0) {
      return { grade, gradeMax };
    }
  }

  return null;
}

export function extractSubjectFromGradeMessage(text: string): string | null {
  const lower = text.toLowerCase();
  const subjects = [
    { key: 'mathématiques', label: 'Maths' },
    { key: 'mathematiques', label: 'Maths' },
    { key: 'maths', label: 'Maths' },
    { key: 'math', label: 'Maths' },
    { key: 'français', label: 'Français' },
    { key: 'francais', label: 'Français' },
    { key: 'histoire', label: 'Histoire' },
    { key: 'géographie', label: 'Géographie' },
    { key: 'geographie', label: 'Géographie' },
    { key: 'anglais', label: 'Anglais' },
    { key: 'espagnol', label: 'Espagnol' },
    { key: 'allemand', label: 'Allemand' },
    { key: 'sciences', label: 'Sciences' },
    { key: 'svt', label: 'SVT' },
    { key: 'physique', label: 'Physique' },
    { key: 'chimie', label: 'Chimie' },
    { key: 'musique', label: 'Musique' },
    { key: 'arts', label: 'Arts' },
    { key: 'sport', label: 'Sport' },
    { key: 'eps', label: 'Sport' },
  ];

  for (const s of subjects) {
    if (lower.includes(s.key)) {
      return s.label;
    }
  }

  return null;
}

export function formatPendingGradesContext(
  events: ProfEvent[],
  detectedGrade?: { grade: number; gradeMax: number } | null
): string {
  if (events.length === 0 && !detectedGrade) return '';

  const lines: string[] = ['## CONTRÔLES EN ATTENTE DE NOTE', ''];

  if (detectedGrade) {
    lines.push(`L'enfant vient de donner une note : **${detectedGrade.grade}/${detectedGrade.gradeMax}**`);
    lines.push('');
  }

  if (events.length > 0) {
    lines.push('Ces contrôles sont passés récemment et n\'ont pas encore de note :');
    for (const ev of events) {
      const daysAgo = Math.floor((Date.now() - ev.due_date) / (24 * 60 * 60 * 1000));
      lines.push(`- [ID: ${ev.id}] ${ev.subject} : ${ev.title} (il y a ${daysAgo} jours)`);
    }
    lines.push('');
  }

  if (detectedGrade) {
    lines.push('👉 Tu DOIS appeler le tool `saveGrade` avec :');
    if (events.length === 1) {
      lines.push(`   - eventId: ${events[0].id}`);
      lines.push(`   - subject: "${events[0].subject}"`);
      lines.push(`   - title: "${events[0].title}"`);
    } else {
      lines.push('   - eventId: 0');
      lines.push('   - subject: la matière détectée dans le message');
      lines.push('   - title: "Contrôle"');
    }
    lines.push(`   - grade: ${detectedGrade.grade}`);
    lines.push(`   - grade_max: ${detectedGrade.gradeMax}`);
    lines.push('');
    lines.push('Puis félicite l\'enfant (si bonne note) ou encourage-le (si moins bonne).');
  } else {
    lines.push('👉 Si l\'enfant te donne une note, tu appelles `saveGrade`.');
  }

  return lines.join('\n');
}

// ============================================================
// PROGRESSION
// ============================================================

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

// ============================================================
// RÉVISIONS ESPACÉES
// ============================================================

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
    '💡 Propose à l\'enfant de réviser la première notion de la liste.'
  );

  return lines.join('\n');
}

// ============================================================
// EMPLOI DU TEMPS
// ============================================================

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

// ============================================================
// RAPPEL DU SOIR
// ============================================================

export function formatEveningBriefingData(
  tomorrowEvents: ProfEvent[],
  tomorrowSchedule: ProfScheduleItem[],
  fragileTopics: ProfTopic[],
  pendingGrades: ProfEvent[] = []
): string {
  const lines: string[] = ['## DONNÉES DU RAPPEL DU SOIR', ''];
  lines.push('Voici ce que tu dois vérifier avec l\'enfant ce soir :');
  lines.push('');

  if (tomorrowEvents.length > 0) {
    lines.push('### 📅 Événements demain :');
    for (const ev of tomorrowEvents) {
      const typeLabel =
        ev.type === 'controle' ? 'Contrôle' :
        ev.type === 'devoir' ? 'Devoir' :
        'Leçon';
      lines.push(`- ${typeLabel} de ${ev.subject} : ${ev.title}`);
    }
    lines.push('');
  }

  if (tomorrowSchedule.length > 0) {
    lines.push('### 📚 Cours demain :');
    const sorted = tomorrowSchedule.sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (const item of sorted) {
      lines.push(`- ${item.start_time} - ${item.subject}`);
    }
    lines.push('');
  }

  if (fragileTopics.length > 0) {
    lines.push('### ⚠️ Notions fragiles à revoir :');
    for (const t of fragileTopics) {
      lines.push(`- ${t.subject} : ${t.topic}`);
    }
    lines.push('');
  }

  if (pendingGrades.length > 0) {
    lines.push('### 📝 Contrôles passés en attente de note :');
    for (const ev of pendingGrades) {
      const daysAgo = Math.floor((Date.now() - ev.due_date) / (24 * 60 * 60 * 1000));
      lines.push(`- [ID: ${ev.id}] ${ev.subject} : ${ev.title} (il y a ${daysAgo} jours)`);
    }
    lines.push('');
    lines.push('👉 Glisse une question COURTE dans ton message du soir pour demander la note.');
    lines.push('   Ex: "Au fait, tu as eu ta note de Maths ? Tu peux me la dire !"');
    lines.push('');
  }

  lines.push('## TON MESSAGE');
  lines.push('');
  lines.push('Tu composes UN message court (3-5 lignes max), chaleureux et utile,');
  lines.push('qui combine ces informations. Tu ne listes PAS tout.');
  lines.push('Tu choisis les informations les PLUS importantes :');
  lines.push('- Si contrôle demain → priorité');
  lines.push('- Si note en attente → demande-la gentiment');
  lines.push('- Sinon → cours du lendemain');

  return lines.join('\n');
}

// ============================================================
// MÉTÉO
// ============================================================

export function formatWeatherForMorningBriefing(
  city: string,
  current: { temp: number; description: string },
  morning: { temp: number; description: string },
  afternoon: { temp: number; description: string },
  evening: { temp: number; description: string },
  advice: string
): string {
  const lines: string[] = [
    '## DONNÉES MÉTÉO (pour le briefing du matin)',
    '',
    `Ville : ${city}`,
    '',
    `Maintenant : ${current.temp}°C, ${current.description}`,
    `Matin : ${morning.temp}°C, ${morning.description}`,
    `Après-midi : ${afternoon.temp}°C, ${afternoon.description}`,
    `Soir : ${evening.temp}°C, ${evening.description}`,
    '',
    `💡 Conseil : ${advice}`,
    '',
    'Tu intègres la météo dans ton briefing du matin :',
    '- Mentionne la température actuelle',
    '- Signale s\'il va pleuvoir ou s\'il fait froid',
    '- Donne le conseil (pull, parapluie, etc.)',
  ];

  return lines.join('\n');
}

// ============================================================
// NOTES SCOLAIRES
// ============================================================

export function formatGradesForPrompt(events: ProfEvent[]): string {
  const eventsWithGrades = events.filter(
    (e) => e.grade !== null && e.grade !== undefined && e.grade_max
  );

  if (eventsWithGrades.length === 0) {
    return `## NOTES SCOLAIRES

Aucune note n'a encore été enregistrée pour cet enfant.
Le bilan doit être bref et proposer de commencer à enregistrer les notes.`;
  }

  const bySubject: Record<string, ProfEvent[]> = {};
  for (const e of eventsWithGrades) {
    const subject = e.subject || 'Autre';
    if (!bySubject[subject]) bySubject[subject] = [];
    bySubject[subject].push(e);
  }

  const lines: string[] = ['## NOTES SCOLAIRES', ''];
  lines.push(`Total : ${eventsWithGrades.length} note(s) enregistrée(s)`);
  lines.push('');

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
      const gradeStr = `${e.grade}/${e.grade_max}`;
      const dateStr = e.grade_at
        ? new Date(e.grade_at).toLocaleDateString('fr-FR')
        : 'date inconnue';
      lines.push(`- ${gradeStr} (${e.title}, ${dateStr})`);
    }
    lines.push('');
  }

  lines.push('## CONSIGNES POUR LE BILAN');
  lines.push('');
  lines.push('- Félicite les bonnes notes');
  lines.push('- Liste les notes par matière avec leur moyenne');
  lines.push('- Encourage sur les matières fragiles (sans juger)');
  lines.push('- Propose de travailler les points faibles');
  lines.push('- Ne juge JAMAIS');
  lines.push('- Termine par un encouragement');

  return lines.join('\n');
}

export function formatPendingGradesForPrompt(events: ProfEvent[]): string {
  if (events.length === 0) return '';

  const lines: string[] = [
    '## CONTRÔLES EN ATTENTE DE NOTE',
    '',
    'Ces contrôles ont eu lieu il y a 2-3 jours et l\'enfant n\'a pas encore donné sa note.',
    'Glisse une question COURTE dans ton message du soir :',
    '',
  ];

  for (const ev of events) {
    const daysAgo = Math.floor((Date.now() - ev.due_date) / (24 * 60 * 60 * 1000));
    lines.push(`- [ID: ${ev.id}] Contrôle de ${ev.subject} : ${ev.title} (il y a ${daysAgo} jours)`);
  }

  lines.push('');
  lines.push('Exemple : "Au fait, tu as eu ta note de Maths ? Tu peux me la dire !"');
  lines.push('');
  lines.push('👉 Quand l\'enfant te donne la note, tu appelles le tool \`saveGrade\`.');

  return lines.join('\n');
}