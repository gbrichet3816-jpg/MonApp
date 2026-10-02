// src/agents/prof/database.ts
// Gestion de la base SQLite locale pour l'Agent Prof

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'agents.db';

export async function openProfDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await initProfTables(db);
  return db;
}

async function initProfTables(db: SQLite.SQLiteDatabase): Promise<void> {
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

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS prof_state (
      user_id TEXT PRIMARY KEY,
      last_review_offer_at INTEGER,
      last_morning_briefing_at INTEGER,
      morning_briefing_hour INTEGER DEFAULT 7,
      morning_briefing_minute INTEGER DEFAULT 30,
      morning_briefing_enabled INTEGER DEFAULT 0,
      morning_briefing_notification_id TEXT,
      last_evening_briefing_at INTEGER,
      evening_briefing_hour INTEGER DEFAULT 18,
      evening_briefing_minute INTEGER DEFAULT 30,
      evening_briefing_enabled INTEGER DEFAULT 0,
      evening_briefing_notification_id TEXT,
      updated_at INTEGER NOT NULL
    );
  `);

  // Migrations (si la table existe déjà avec une ancienne version)
  const migrations = [
    `ALTER TABLE prof_state ADD COLUMN morning_briefing_hour INTEGER DEFAULT 7;`,
    `ALTER TABLE prof_state ADD COLUMN morning_briefing_minute INTEGER DEFAULT 30;`,
    `ALTER TABLE prof_state ADD COLUMN morning_briefing_enabled INTEGER DEFAULT 0;`,
    `ALTER TABLE prof_state ADD COLUMN morning_briefing_notification_id TEXT;`,
    `ALTER TABLE prof_state ADD COLUMN last_evening_briefing_at INTEGER;`,
    `ALTER TABLE prof_state ADD COLUMN evening_briefing_hour INTEGER DEFAULT 18;`,
    `ALTER TABLE prof_state ADD COLUMN evening_briefing_minute INTEGER DEFAULT 30;`,
    `ALTER TABLE prof_state ADD COLUMN evening_briefing_enabled INTEGER DEFAULT 0;`,
    `ALTER TABLE prof_state ADD COLUMN evening_briefing_notification_id TEXT;`,
  ];

  for (const sql of migrations) {
    try {
      await db.execAsync(sql);
    } catch (e) {
      // Colonne existe déjà : on ignore
    }
  }
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

export async function getProfProfile(db: SQLite.SQLiteDatabase, userId: string): Promise<ProfProfile | null> {
  const row = await db.getFirstAsync<ProfProfile>('SELECT * FROM prof_profile WHERE user_id = ?', [userId]);
  return row ?? null;
}

export async function createProfProfile(db: SQLite.SQLiteDatabase, userId: string, childName: string, childAge: number, childGrade: string, childLevel: string): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT OR REPLACE INTO prof_profile
     (user_id, child_name, child_age, child_grade, child_level, points, onboarded, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)`,
    [userId, childName, childAge, childGrade, childLevel, now, now]
  );
}

export async function updateProfProfile(db: SQLite.SQLiteDatabase, userId: string, updates: Partial<Pick<ProfProfile, 'child_name' | 'child_age' | 'child_grade' | 'child_level' | 'points'>>): Promise<void> {
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
  await db.runAsync(`UPDATE prof_profile SET ${fields.join(', ')} WHERE user_id = ?`, values);
}

export async function addProfPoints(db: SQLite.SQLiteDatabase, userId: string, delta: number): Promise<void> {
  await db.runAsync(`UPDATE prof_profile SET points = points + ?, updated_at = ? WHERE user_id = ?`, [delta, Date.now(), userId]);
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

export async function saveProfMessage(db: SQLite.SQLiteDatabase, userId: string, role: ProfMessage['role'], content: string): Promise<void> {
  await db.runAsync(`INSERT INTO prof_messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)`, [userId, role, content, Date.now()]);
}

export async function getProfMessages(db: SQLite.SQLiteDatabase, userId: string, limit: number = 50): Promise<ProfMessage[]> {
  return await db.getAllAsync<ProfMessage>(`SELECT * FROM prof_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT ?`, [userId, limit]);
}

export async function clearProfMessages(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
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

export async function addScheduleItem(db: SQLite.SQLiteDatabase, item: Omit<ProfScheduleItem, 'id' | 'created_at'>): Promise<void> {
  await db.runAsync(
    `INSERT INTO prof_schedule (user_id, day_of_week, start_time, end_time, subject, room, teacher, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [item.user_id, item.day_of_week, item.start_time, item.end_time, item.subject, item.room ?? null, item.teacher ?? null, Date.now()]
  );
}

export async function getSchedule(db: SQLite.SQLiteDatabase, userId: string, dayOfWeek?: number): Promise<ProfScheduleItem[]> {
  if (dayOfWeek !== undefined) {
    return await db.getAllAsync<ProfScheduleItem>(`SELECT * FROM prof_schedule WHERE user_id = ? AND day_of_week = ? ORDER BY start_time ASC`, [userId, dayOfWeek]);
  }
  return await db.getAllAsync<ProfScheduleItem>(`SELECT * FROM prof_schedule WHERE user_id = ? ORDER BY day_of_week ASC, start_time ASC`, [userId]);
}

export async function clearSchedule(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  await db.runAsync('DELETE FROM prof_schedule WHERE user_id = ?', [userId]);
}

// ============================================================
// ÉVÉNEMENTS
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

export async function addProfEvent(db: SQLite.SQLiteDatabase, event: Omit<ProfEvent, 'id' | 'created_at' | 'done'> & { done?: number }): Promise<void> {
  await db.runAsync(
    `INSERT INTO prof_events (user_id, type, subject, title, due_date, done, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [event.user_id, event.type, event.subject ?? null, event.title, event.due_date, event.done ?? 0, Date.now()]
  );
}

export async function getUpcomingEvents(db: SQLite.SQLiteDatabase, userId: string, limit: number = 20): Promise<ProfEvent[]> {
  return await db.getAllAsync<ProfEvent>(`SELECT * FROM prof_events WHERE user_id = ? AND done = 0 AND due_date >= ? ORDER BY due_date ASC LIMIT ?`, [userId, Date.now(), limit]);
}

/**
 * 🆕 Récupère les événements prévus pour une date précise (par défaut demain).
 */
export async function getEventsForDate(db: SQLite.SQLiteDatabase, userId: string, date: Date): Promise<ProfEvent[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return await db.getAllAsync<ProfEvent>(
    `SELECT * FROM prof_events
     WHERE user_id = ? AND done = 0 AND due_date BETWEEN ? AND ?
     ORDER BY due_date ASC`,
    [userId, startOfDay.getTime(), endOfDay.getTime()]
  );
}

export async function markEventDone(db: SQLite.SQLiteDatabase, eventId: number): Promise<void> {
  await db.runAsync('UPDATE prof_events SET done = 1 WHERE id = ?', [eventId]);
}

export async function deleteProfEvent(db: SQLite.SQLiteDatabase, eventId: number): Promise<void> {
  await db.runAsync('DELETE FROM prof_events WHERE id = ?', [eventId]);
}

// ============================================================
// NOTIONS TRAVAILLÉES
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

const REVIEW_INTERVALS_DAYS = [1, 3, 7, 21, 60];

function computeNextReviewAt(stage: number): number {
  const days = REVIEW_INTERVALS_DAYS[Math.min(stage, REVIEW_INTERVALS_DAYS.length - 1)];
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

export async function saveTopicProgress(db: SQLite.SQLiteDatabase, userId: string, subject: string, topic: string, result: 'success' | 'fail'): Promise<void> {
  const now = Date.now();
  const existing = await db.getFirstAsync<ProfTopic>(`SELECT * FROM prof_topics WHERE user_id = ? AND subject = ? AND topic = ?`, [userId, subject, topic]);

  if (existing && existing.id !== undefined) {
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
      `UPDATE prof_topics SET status = ?, review_stage = ?, next_review_at = ?, times_seen = times_seen + 1, times_success = times_success + ?, last_seen = ? WHERE id = ?`,
      [newStatus, newStage, nextReview, result === 'success' ? 1 : 0, now, existing.id]
    );
  } else {
    const stage = result === 'success' ? 1 : 0;
    const status: ProfTopic['status'] = result === 'success' ? 'in_progress' : 'fragile';
    const nextReview = computeNextReviewAt(stage);
    await db.runAsync(
      `INSERT INTO prof_topics (user_id, subject, topic, status, review_stage, next_review_at, times_seen, times_success, last_seen, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [userId, subject, topic, status, stage, nextReview, result === 'success' ? 1 : 0, now, now]
    );
  }
}

export async function getAllTopics(db: SQLite.SQLiteDatabase, userId: string): Promise<ProfTopic[]> {
  return await db.getAllAsync<ProfTopic>(`SELECT * FROM prof_topics WHERE user_id = ? ORDER BY subject ASC, last_seen DESC`, [userId]);
}

export async function getTopicsToReview(db: SQLite.SQLiteDatabase, userId: string): Promise<ProfTopic[]> {
  return await db.getAllAsync<ProfTopic>(`SELECT * FROM prof_topics WHERE user_id = ? AND next_review_at <= ? AND status != 'acquired' ORDER BY next_review_at ASC LIMIT 5`, [userId, Date.now()]);
}

/**
 * 🆕 Récupère uniquement les notions "fragiles" (pour le rappel du soir).
 */
export async function getFragileTopics(db: SQLite.SQLiteDatabase, userId: string): Promise<ProfTopic[]> {
  return await db.getAllAsync<ProfTopic>(
    `SELECT * FROM prof_topics
     WHERE user_id = ? AND status = 'fragile'
     ORDER BY last_seen ASC
     LIMIT 3`,
    [userId]
  );
}

export async function deleteTopic(db: SQLite.SQLiteDatabase, topicId: number): Promise<void> {
  await db.runAsync('DELETE FROM prof_topics WHERE id = ?', [topicId]);
}

// ============================================================
// ÉTAT GÉNÉRAL
// ============================================================

export interface ProfState {
  user_id: string;
  last_review_offer_at: number | null;
  last_morning_briefing_at: number | null;
  morning_briefing_hour: number;
  morning_briefing_minute: number;
  morning_briefing_enabled: number;
  morning_briefing_notification_id: string | null;
  last_evening_briefing_at: number | null;
  evening_briefing_hour: number;
  evening_briefing_minute: number;
  evening_briefing_enabled: number;
  evening_briefing_notification_id: string | null;
  updated_at: number;
}

export async function getProfState(db: SQLite.SQLiteDatabase, userId: string): Promise<ProfState> {
  let state = await db.getFirstAsync<ProfState>('SELECT * FROM prof_state WHERE user_id = ?', [userId]);

  if (!state) {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO prof_state (user_id, updated_at) VALUES (?, ?)`,
      [userId, now]
    );
    state = {
      user_id: userId,
      last_review_offer_at: null,
      last_morning_briefing_at: null,
      morning_briefing_hour: 7,
      morning_briefing_minute: 30,
      morning_briefing_enabled: 0,
      morning_briefing_notification_id: null,
      last_evening_briefing_at: null,
      evening_briefing_hour: 18,
      evening_briefing_minute: 30,
      evening_briefing_enabled: 0,
      evening_briefing_notification_id: null,
      updated_at: now,
    };
  }

  return state;
}

export async function markReviewOffered(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO prof_state (user_id, last_review_offer_at, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET last_review_offer_at = excluded.last_review_offer_at, updated_at = excluded.updated_at`,
    [userId, now, now]
  );
}

export async function canOfferReviewToday(db: SQLite.SQLiteDatabase, userId: string): Promise<boolean> {
  const state = await getProfState(db, userId);
  if (!state.last_review_offer_at) return true;
  const twentyHoursAgo = Date.now() - 20 * 60 * 60 * 1000;
  return state.last_review_offer_at < twentyHoursAgo;
}

export async function markMorningBriefingSent(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO prof_state (user_id, last_morning_briefing_at, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET last_morning_briefing_at = excluded.last_morning_briefing_at, updated_at = excluded.updated_at`,
    [userId, now, now]
  );
}

export async function wasMorningBriefingSentToday(db: SQLite.SQLiteDatabase, userId: string): Promise<boolean> {
  const state = await getProfState(db, userId);
  if (!state.last_morning_briefing_at) return false;
  const lastDate = new Date(state.last_morning_briefing_at);
  const today = new Date();
  return (
    lastDate.getDate() === today.getDate() &&
    lastDate.getMonth() === today.getMonth() &&
    lastDate.getFullYear() === today.getFullYear()
  );
}

export async function enableMorningBriefing(db: SQLite.SQLiteDatabase, userId: string, hour: number, minute: number, notificationId: string): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO prof_state (user_id, morning_briefing_hour, morning_briefing_minute, morning_briefing_enabled, morning_briefing_notification_id, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       morning_briefing_hour = excluded.morning_briefing_hour,
       morning_briefing_minute = excluded.morning_briefing_minute,
       morning_briefing_enabled = 1,
       morning_briefing_notification_id = excluded.morning_briefing_notification_id,
       updated_at = excluded.updated_at`,
    [userId, hour, minute, notificationId, now]
  );
}

export async function disableMorningBriefing(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  await db.runAsync(
    `UPDATE prof_state SET morning_briefing_enabled = 0, morning_briefing_notification_id = NULL, updated_at = ? WHERE user_id = ?`,
    [Date.now(), userId]
  );
}

// ============================================================
// 🆕 RAPPEL DU SOIR
// ============================================================

export async function markEveningBriefingSent(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO prof_state (user_id, last_evening_briefing_at, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET last_evening_briefing_at = excluded.last_evening_briefing_at, updated_at = excluded.updated_at`,
    [userId, now, now]
  );
}

export async function wasEveningBriefingSentToday(db: SQLite.SQLiteDatabase, userId: string): Promise<boolean> {
  const state = await getProfState(db, userId);
  if (!state.last_evening_briefing_at) return false;
  const lastDate = new Date(state.last_evening_briefing_at);
  const today = new Date();
  return (
    lastDate.getDate() === today.getDate() &&
    lastDate.getMonth() === today.getMonth() &&
    lastDate.getFullYear() === today.getFullYear()
  );
}

export async function enableEveningBriefing(db: SQLite.SQLiteDatabase, userId: string, hour: number, minute: number, notificationId: string): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO prof_state (user_id, evening_briefing_hour, evening_briefing_minute, evening_briefing_enabled, evening_briefing_notification_id, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       evening_briefing_hour = excluded.evening_briefing_hour,
       evening_briefing_minute = excluded.evening_briefing_minute,
       evening_briefing_enabled = 1,
       evening_briefing_notification_id = excluded.evening_briefing_notification_id,
       updated_at = excluded.updated_at`,
    [userId, hour, minute, notificationId, now]
  );
}

export async function updateEveningBriefingTime(db: SQLite.SQLiteDatabase, userId: string, hour: number, minute: number): Promise<void> {
  await db.runAsync(
    `UPDATE prof_state SET evening_briefing_hour = ?, evening_briefing_minute = ?, updated_at = ? WHERE user_id = ?`,
    [hour, minute, Date.now(), userId]
  );
}

export async function disableEveningBriefing(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  await db.runAsync(
    `UPDATE prof_state SET evening_briefing_enabled = 0, evening_briefing_notification_id = NULL, updated_at = ? WHERE user_id = ?`,
    [Date.now(), userId]
  );
}