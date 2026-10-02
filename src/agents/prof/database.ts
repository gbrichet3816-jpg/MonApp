// src/agents/prof/database.ts
// Gestion de la base SQLite locale pour l'Agent Prof

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'agents.db';

/**
 * Ouvre (ou crée) la base de données.
 */
export async function openProfDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await initProfTables(db);
  return db;
}

/**
 * Crée les tables spécifiques à l'Agent Prof si elles n'existent pas.
 */
async function initProfTables(db: SQLite.SQLiteDatabase): Promise<void> {
  // 1. Profil de l'enfant
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS prof_profile (
      user_id TEXT PRIMARY KEY,
      child_name TEXT,
      child_age INTEGER,
      child_grade TEXT,
      child_level TEXT,
      points INTEGER DEFAULT 0,
      onboarded INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // 2. Historique des messages
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS prof_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prof_messages_user
      ON prof_messages(user_id, created_at);
  `);

  // 3. Emploi du temps
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS prof_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      subject TEXT NOT NULL,
      room TEXT,
      teacher TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prof_schedule_user
      ON prof_schedule(user_id, day_of_week);
  `);

  // 4. Événements (contrôles / devoirs / leçons)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS prof_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      subject TEXT,
      title TEXT NOT NULL,
      due_date INTEGER NOT NULL,
      done INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prof_events_user
      ON prof_events(user_id, due_date);
  `);

  // 5. Notions travaillées (pour le bilan + révisions espacées)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS prof_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      topic TEXT NOT NULL,
      status TEXT DEFAULT 'in_progress',
      review_stage INTEGER DEFAULT 0,
      next_review_at INTEGER NOT NULL,
      times_seen INTEGER DEFAULT 1,
      times_success INTEGER DEFAULT 0,
      last_seen INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, subject, topic)
    );
    CREATE INDEX IF NOT EXISTS idx_prof_topics_user
      ON prof_topics(user_id, next_review_at);
  `);
}

// ============================================================
// PROFIL ENFANT
// ============================================================

export interface ProfProfile {
  user_id: string;
  child_name: string;
  child_age: number;
  child_grade: string;
  child_level: string;
  points: number;
  onboarded: number;
  created_at: number;
  updated_at: number;
}

export async function getProfProfile(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<ProfProfile | null> {
  const row = await db.getFirstAsync<ProfProfile>(
    'SELECT * FROM prof_profile WHERE user_id = ?',
    [userId]
  );
  return row ?? null;
}

export async function createProfProfile(
  db: SQLite.SQLiteDatabase,
  userId: string,
  childName: string,
  childAge: number,
  childGrade: string,
  childLevel: string
): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT OR REPLACE INTO prof_profile
     (user_id, child_name, child_age, child_grade, child_level, points, onboarded, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)`,
    [userId, childName, childAge, childGrade, childLevel, now, now]
  );
}

export async function updateProfProfile(
  db: SQLite.SQLiteDatabase,
  userId: string,
  updates: Partial<Pick<ProfProfile, 'child_name' | 'child_age' | 'child_grade' | 'child_level' | 'points'>>
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.child_name !== undefined) { fields.push('child_name = ?'); values.push(updates.child_name); }
  if (updates.child_age !== undefined) { fields.push('child_age = ?'); values.push(updates.child_age); }
  if (updates.child_grade !== undefined) { fields.push('child_grade = ?'); values.push(updates.child_grade); }
  if (updates.child_level !== undefined) { fields.push('child_level = ?'); values.push(updates.child_level); }
  if (updates.points !== undefined) { fields.push('points = ?'); values.push(updates.points); }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(userId);

  await db.runAsync(
    `UPDATE prof_profile SET ${fields.join(', ')} WHERE user_id = ?`,
    values
  );
}

export async function addProfPoints(
  db: SQLite.SQLiteDatabase,
  userId: string,
  delta: number
): Promise<void> {
  await db.runAsync(
    `UPDATE prof_profile
     SET points = points + ?, updated_at = ?
     WHERE user_id = ?`,
    [delta, Date.now(), userId]
  );
}

// ============================================================
// MESSAGES
// ============================================================

export interface ProfMessage {
  id?: number;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
}

export async function saveProfMessage(
  db: SQLite.SQLiteDatabase,
  userId: string,
  role: ProfMessage['role'],
  content: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO prof_messages (user_id, role, content, created_at)
     VALUES (?, ?, ?, ?)`,
    [userId, role, content, Date.now()]
  );
}

export async function getProfMessages(
  db: SQLite.SQLiteDatabase,
  userId: string,
  limit: number = 50
): Promise<ProfMessage[]> {
  return await db.getAllAsync<ProfMessage>(
    `SELECT * FROM prof_messages
     WHERE user_id = ?
     ORDER BY created_at ASC
     LIMIT ?`,
    [userId, limit]
  );
}

export async function clearProfMessages(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<void> {
  await db.runAsync('DELETE FROM prof_messages WHERE user_id = ?', [userId]);
}

// ============================================================
// EMPLOI DU TEMPS
// ============================================================

export interface ProfScheduleItem {
  id?: number;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  room?: string;
  teacher?: string;
  created_at?: number;
}

export async function addScheduleItem(
  db: SQLite.SQLiteDatabase,
  item: Omit<ProfScheduleItem, 'id' | 'created_at'>
): Promise<void> {
  await db.runAsync(
    `INSERT INTO prof_schedule
     (user_id, day_of_week, start_time, end_time, subject, room, teacher, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.user_id,
      item.day_of_week,
      item.start_time,
      item.end_time,
      item.subject,
      item.room ?? null,
      item.teacher ?? null,
      Date.now(),
    ]
  );
}

export async function getSchedule(
  db: SQLite.SQLiteDatabase,
  userId: string,
  dayOfWeek?: number
): Promise<ProfScheduleItem[]> {
  if (dayOfWeek !== undefined) {
    return await db.getAllAsync<ProfScheduleItem>(
      `SELECT * FROM prof_schedule
       WHERE user_id = ? AND day_of_week = ?
       ORDER BY start_time ASC`,
      [userId, dayOfWeek]
    );
  }
  return await db.getAllAsync<ProfScheduleItem>(
    `SELECT * FROM prof_schedule
     WHERE user_id = ?
     ORDER BY day_of_week ASC, start_time ASC`,
    [userId]
  );
}

export async function clearSchedule(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<void> {
  await db.runAsync('DELETE FROM prof_schedule WHERE user_id = ?', [userId]);
}

// ============================================================
// ÉVÉNEMENTS (CONTRÔLES / DEVOIRS)
// ============================================================

export interface ProfEvent {
  id?: number;
  user_id: string;
  type: 'controle' | 'devoir' | 'lecon';
  subject?: string;
  title: string;
  due_date: number;
  done: number;
  created_at?: number;
}

export async function addProfEvent(
  db: SQLite.SQLiteDatabase,
  event: Omit<ProfEvent, 'id' | 'created_at' | 'done'> & { done?: number }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO prof_events
     (user_id, type, subject, title, due_date, done, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      event.user_id,
      event.type,
      event.subject ?? null,
      event.title,
      event.due_date,
      event.done ?? 0,
      Date.now(),
    ]
  );
}

export async function getUpcomingEvents(
  db: SQLite.SQLiteDatabase,
  userId: string,
  limit: number = 20
): Promise<ProfEvent[]> {
  return await db.getAllAsync<ProfEvent>(
    `SELECT * FROM prof_events
     WHERE user_id = ? AND done = 0 AND due_date >= ?
     ORDER BY due_date ASC
     LIMIT ?`,
    [userId, Date.now(), limit]
  );
}

export async function markEventDone(
  db: SQLite.SQLiteDatabase,
  eventId: number
): Promise<void> {
  await db.runAsync('UPDATE prof_events SET done = 1 WHERE id = ?', [eventId]);
}

export async function deleteProfEvent(
  db: SQLite.SQLiteDatabase,
  eventId: number
): Promise<void> {
  await db.runAsync('DELETE FROM prof_events WHERE id = ?', [eventId]);
}

// ============================================================
// NOTIONS TRAVAILLÉES + RÉVISIONS ESPACÉES
// ============================================================

export interface ProfTopic {
  id?: number;
  user_id: string;
  subject: string;
  topic: string;
  status: 'in_progress' | 'acquired' | 'fragile';
  review_stage: number;
  next_review_at: number;
  times_seen: number;
  times_success: number;
  last_seen: number;
  created_at?: number;
}

/**
 * Intervalles des révisions espacées (en jours).
 * Stage 0 → J+1, Stage 1 → J+3, Stage 2 → J+7, Stage 3 → J+21, Stage 4 → J+60
 */
const REVIEW_INTERVALS_DAYS = [1, 3, 7, 21, 60];

/**
 * Calcule la prochaine date de révision selon le stage.
 */
function computeNextReviewAt(stage: number): number {
  const days = REVIEW_INTERVALS_DAYS[Math.min(stage, REVIEW_INTERVALS_DAYS.length - 1)];
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

/**
 * Enregistre une notion travaillée (ou met à jour si elle existe déjà).
 */
export async function saveTopicProgress(
  db: SQLite.SQLiteDatabase,
  userId: string,
  subject: string,
  topic: string,
  result: 'success' | 'fail'
): Promise<void> {
  const now = Date.now();

  const existing = await db.getFirstAsync<ProfTopic>(
    `SELECT * FROM prof_topics
     WHERE user_id = ? AND subject = ? AND topic = ?`,
    [userId, subject, topic]
  );

  if (existing && existing.id !== undefined) {
    // Mise à jour
    let newStage = existing.review_stage;
    let newStatus: ProfTopic['status'] = existing.status;

    if (result === 'success') {
      newStage = Math.min(existing.review_stage + 1, REVIEW_INTERVALS_DAYS.length);
      newStatus = newStage >= REVIEW_INTERVALS_DAYS.length ? 'acquired' : 'in_progress';
    } else {
      newStage = Math.max(0, existing.review_stage - 1);
      newStatus = 'fragile';
    }

    const nextReview = computeNextReviewAt(newStage);

    await db.runAsync(
      `UPDATE prof_topics
       SET status = ?,
           review_stage = ?,
           next_review_at = ?,
           times_seen = times_seen + 1,
           times_success = times_success + ?,
           last_seen = ?
       WHERE id = ?`,
      [
        newStatus,
        newStage,
        nextReview,
        result === 'success' ? 1 : 0,
        now,
        existing.id,
      ]
    );
  } else {
    // Nouvelle notion
    const stage = result === 'success' ? 1 : 0;
    const status: ProfTopic['status'] = result === 'success' ? 'in_progress' : 'fragile';
    const nextReview = computeNextReviewAt(stage);

    await db.runAsync(
      `INSERT INTO prof_topics
       (user_id, subject, topic, status, review_stage, next_review_at,
        times_seen, times_success, last_seen, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        userId,
        subject,
        topic,
        status,
        stage,
        nextReview,
        result === 'success' ? 1 : 0,
        now,
        now,
      ]
    );
  }
}

/**
 * Récupère toutes les notions d'un utilisateur (pour le bilan).
 */
export async function getAllTopics(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<ProfTopic[]> {
  return await db.getAllAsync<ProfTopic>(
    `SELECT * FROM prof_topics
     WHERE user_id = ?
     ORDER BY subject ASC, last_seen DESC`,
    [userId]
  );
}

/**
 * Récupère les notions à revoir aujourd'hui (pour les révisions espacées).
 */
export async function getTopicsToReview(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<ProfTopic[]> {
  return await db.getAllAsync<ProfTopic>(
    `SELECT * FROM prof_topics
     WHERE user_id = ?
       AND next_review_at <= ?
       AND status != 'acquired'
     ORDER BY next_review_at ASC
     LIMIT 5`,
    [userId, Date.now()]
  );
}

/**
 * Supprime une notion.
 */
export async function deleteTopic(
  db: SQLite.SQLiteDatabase,
  topicId: number
): Promise<void> {
  await db.runAsync('DELETE FROM prof_topics WHERE id = ?', [topicId]);
}