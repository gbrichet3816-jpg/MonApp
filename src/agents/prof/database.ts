// src/agents/prof/database.ts
// Gestion de la base SQLite locale pour l'Agent Prof

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'agents.db';

/**
 * Ouvre (ou crée) la base de données.
 * À appeler une seule fois au démarrage de l'agent.
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
  // 1. Profil de l'enfant (1 seule ligne par user_id)
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

  // 2. Historique des messages du chat Prof
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

  // 4. Contrôles / devoirs / leçons planifiés
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
// MESSAGES (HISTORIQUE CHAT)
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