// src/agents/prof/database.ts
// Gestion de la base SQLite locale pour l'Agent Prof
// ⚠️ VERSION SYNCHRONE (bug NativeDatabase.prepareAsync sur Expo SDK 57)

import * as SQLite from 'expo-sqlite';

// 🆕 Utilise la même base que src/config/database.ts
const DB_NAME = 'monapp.db';

let profDb: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;

/**
 * Ouvre (ou récupère) la base de données.
 * Utilise openDatabaseSync (synchrone) pour éviter le bug
 * NativeDatabase.prepareAsync sur Expo SDK 57.
 */
export function openProfDatabaseSync(): SQLite.SQLiteDatabase {
  if (profDb && isInitialized) {
    return profDb;
  }

  try {
    profDb = SQLite.openDatabaseSync(DB_NAME);

    if (!isInitialized) {
      initProfTables(profDb);
      isInitialized = true;
    }

    return profDb;
  } catch (e) {
    profDb = null;
    isInitialized = false;
    console.error('[Prof DB] Erreur ouverture base:', e);
    throw e;
  }
}

// 🆕 Garde la version async pour compatibilité (appelle la version sync)
export async function openProfDatabase(): Promise<SQLite.SQLiteDatabase> {
  return openProfDatabaseSync();
}

function initProfTables(db: SQLite.SQLiteDatabase): void {
  // 1. Profil de l'enfant
  db.execSync(`
    CREATE TABLE IF NOT EXISTS prof_profile (
      user_id TEXT PRIMARY KEY,
      child_name TEXT,
      child_age INTEGER,
      child_grade TEXT,
      child_level TEXT,
      points INTEGER DEFAULT 0,
      onboarded INTEGER DEFAULT 0,
      weather_city TEXT,
      weather_cache_json TEXT,
      weather_cache_at INTEGER,
      weather_city_refusals INTEGER DEFAULT 0,
      weather_enabled INTEGER DEFAULT 1,
      tts_downloaded INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // 2. Historique des messages
  db.execSync(`
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
  db.execSync(`
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

  // 4. Événements (avec notes)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS prof_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      subject TEXT,
      title TEXT NOT NULL,
      due_date INTEGER NOT NULL,
      done INTEGER DEFAULT 0,
      grade REAL,
      grade_max REAL,
      grade_at INTEGER,
      grade_asked INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prof_events_user
      ON prof_events(user_id, due_date);
  `);

  // 5. Notions travaillées
  db.execSync(`
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

  // 6. État général
  db.execSync(`
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
      last_weather_refusal_prompt_at INTEGER,
      updated_at INTEGER NOT NULL
    );
  `);

  // 🆕 7. Mémoire longue : résumés de conversations
  db.execSync(`
    CREATE TABLE IF NOT EXISTS prof_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      messages_count INTEGER NOT NULL,
      period_start INTEGER NOT NULL,
      period_end INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prof_summaries_user
      ON prof_summaries(user_id, created_at DESC);
  `);

  // 🆕 8. Mémoire longue : comportements/méthodes apprises
  db.execSync(`
    CREATE TABLE IF NOT EXISTS prof_learned_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      pattern TEXT NOT NULL,
      confidence INTEGER DEFAULT 1,
      times_observed INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, category, pattern)
    );
    CREATE INDEX IF NOT EXISTS idx_prof_patterns_user
      ON prof_learned_patterns(user_id, confidence DESC);
  `);

  // Migrations
  const migrations = [
    `ALTER TABLE prof_profile ADD COLUMN weather_city TEXT;`,
    `ALTER TABLE prof_profile ADD COLUMN weather_cache_json TEXT;`,
    `ALTER TABLE prof_profile ADD COLUMN weather_cache_at INTEGER;`,
    `ALTER TABLE prof_profile ADD COLUMN weather_city_refusals INTEGER DEFAULT 0;`,
    `ALTER TABLE prof_profile ADD COLUMN weather_enabled INTEGER DEFAULT 1;`,
    `ALTER TABLE prof_profile ADD COLUMN tts_downloaded INTEGER DEFAULT 0;`,
    `ALTER TABLE prof_state ADD COLUMN morning_briefing_hour INTEGER DEFAULT 7;`,
    `ALTER TABLE prof_state ADD COLUMN morning_briefing_minute INTEGER DEFAULT 30;`,
    `ALTER TABLE prof_state ADD COLUMN morning_briefing_enabled INTEGER DEFAULT 0;`,
    `ALTER TABLE prof_state ADD COLUMN morning_briefing_notification_id TEXT;`,
    `ALTER TABLE prof_state ADD COLUMN last_evening_briefing_at INTEGER;`,
    `ALTER TABLE prof_state ADD COLUMN evening_briefing_hour INTEGER DEFAULT 18;`,
    `ALTER TABLE prof_state ADD COLUMN evening_briefing_minute INTEGER DEFAULT 30;`,
    `ALTER TABLE prof_state ADD COLUMN evening_briefing_enabled INTEGER DEFAULT 0;`,
    `ALTER TABLE prof_state ADD COLUMN evening_briefing_notification_id TEXT;`,
    `ALTER TABLE prof_state ADD COLUMN last_weather_refusal_prompt_at INTEGER;`,
    `ALTER TABLE prof_events ADD COLUMN grade REAL;`,
    `ALTER TABLE prof_events ADD COLUMN grade_max REAL;`,
    `ALTER TABLE prof_events ADD COLUMN grade_at INTEGER;`,
    `ALTER TABLE prof_events ADD COLUMN grade_asked INTEGER DEFAULT 0;`,
  ];

  for (const sql of migrations) {
    try {
      db.execSync(sql);
    } catch (e) {
      // Colonne existe déjà
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
  weather_city: string | null;
  weather_cache_json: string | null;
  weather_cache_at: number | null;
  weather_city_refusals: number;
  weather_enabled: number;
  tts_downloaded: number;
  created_at: number;
  updated_at: number;
}

export async function getProfProfile(db: SQLite.SQLiteDatabase, userId: string): Promise<ProfProfile | null> {
  const row = db.getFirstSync<ProfProfile>('SELECT * FROM prof_profile WHERE user_id = ?', [userId]);
  return row ?? null;
}

export async function createProfProfile(db: SQLite.SQLiteDatabase, userId: string, childName: string, childAge: number, childGrade: string, childLevel: string): Promise<void> {
  const now = Date.now();
  db.runSync(
    `INSERT OR REPLACE INTO prof_profile
     (user_id, child_name, child_age, child_grade, child_level, points, onboarded,
      weather_city, weather_cache_json, weather_cache_at, weather_city_refusals, weather_enabled,
      tts_downloaded, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, 1, NULL, NULL, NULL, 0, 1, 0, ?, ?)`,
    [userId, childName, childAge, childGrade, childLevel, now, now]
  );
}

export async function updateProfProfile(db: SQLite.SQLiteDatabase, userId: string, updates: Partial<Pick<ProfProfile, 'child_name' | 'child_age' | 'child_grade' | 'child_level' | 'points' | 'weather_city' | 'weather_cache_json' | 'weather_cache_at' | 'weather_city_refusals' | 'weather_enabled' | 'tts_downloaded'>>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.child_name !== undefined) { fields.push('child_name = ?'); values.push(updates.child_name); }
  if (updates.child_age !== undefined) { fields.push('child_age = ?'); values.push(updates.child_age); }
  if (updates.child_grade !== undefined) { fields.push('child_grade = ?'); values.push(updates.child_grade); }
  if (updates.child_level !== undefined) { fields.push('child_level = ?'); values.push(updates.child_level); }
  if (updates.points !== undefined) { fields.push('points = ?'); values.push(updates.points); }
  if (updates.weather_city !== undefined) { fields.push('weather_city = ?'); values.push(updates.weather_city); }
  if (updates.weather_cache_json !== undefined) { fields.push('weather_cache_json = ?'); values.push(updates.weather_cache_json); }
  if (updates.weather_cache_at !== undefined) { fields.push('weather_cache_at = ?'); values.push(updates.weather_cache_at); }
  if (updates.weather_city_refusals !== undefined) { fields.push('weather_city_refusals = ?'); values.push(updates.weather_city_refusals); }
  if (updates.weather_enabled !== undefined) { fields.push('weather_enabled = ?'); values.push(updates.weather_enabled); }
  if (updates.tts_downloaded !== undefined) { fields.push('tts_downloaded = ?'); values.push(updates.tts_downloaded); }

  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(userId);
  db.runSync(`UPDATE prof_profile SET ${fields.join(', ')} WHERE user_id = ?`, values);
}

export async function addProfPoints(db: SQLite.SQLiteDatabase, userId: string, delta: number): Promise<void> {
  db.runSync(`UPDATE prof_profile SET points = points + ?, updated_at = ? WHERE user_id = ?`, [delta, Date.now(), userId]);
}

// ============================================================
// TTS
// ============================================================

export async function isTtsDownloaded(db: SQLite.SQLiteDatabase, userId: string): Promise<boolean> {
  const profile = await getProfProfile(db, userId);
  return profile?.tts_downloaded === 1;
}

export async function setTtsDownloaded(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  db.runSync(
    `UPDATE prof_profile SET tts_downloaded = 1, updated_at = ? WHERE user_id = ?`,
    [Date.now(), userId]
  );
}

// ============================================================
// MÉTÉO
// ============================================================

export async function setWeatherCity(db: SQLite.SQLiteDatabase, userId: string, city: string): Promise<void> {
  const now = Date.now();
  db.runSync(
    `UPDATE prof_profile
     SET weather_city = ?, weather_cache_json = NULL, weather_cache_at = NULL,
         weather_city_refusals = 0, weather_enabled = 1, updated_at = ?
     WHERE user_id = ?`,
    [city, now, userId]
  );
}

export async function cacheWeather(db: SQLite.SQLiteDatabase, userId: string, json: string): Promise<void> {
  try {
    if (!db) return;
    const now = Date.now();

    const profile = db.getFirstSync<{ user_id: string }>(
      'SELECT user_id FROM prof_profile WHERE user_id = ?',
      [userId]
    );

    if (!profile) {
      db.runSync(
        `INSERT INTO prof_profile (user_id, child_name, child_age, child_grade, child_level, created_at, updated_at)
         VALUES (?, 'Enfant', 10, 'CM2', 'cm1_6e', ?, ?)`,
        [userId, now, now]
      );
    }

    db.runSync(
      `UPDATE prof_profile SET weather_cache_json = ?, weather_cache_at = ?, updated_at = ? WHERE user_id = ?`,
      [json, now, now, userId]
    );
  } catch (e) {
    console.warn('[Prof DB] cacheWeather échoué (non bloquant):', e);
  }
}

export async function getCachedWeather(db: SQLite.SQLiteDatabase, userId: string): Promise<string | null> {
  try {
    if (!db) return null;

    const profile = await getProfProfile(db, userId);
    if (!profile || !profile.weather_cache_json || !profile.weather_cache_at) return null;
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (profile.weather_cache_at < oneHourAgo) return null;
    return profile.weather_cache_json;
  } catch (e) {
    console.warn('[Prof DB] getCachedWeather échoué:', e);
    return null;
  }
}

export async function incrementWeatherRefusal(db: SQLite.SQLiteDatabase, userId: string): Promise<number> {
  const profile = await getProfProfile(db, userId);
  if (!profile) return 0;
  const newCount = (profile.weather_city_refusals || 0) + 1;
  db.runSync(
    `UPDATE prof_profile SET weather_city_refusals = ?, updated_at = ? WHERE user_id = ?`,
    [newCount, Date.now(), userId]
  );
  return newCount;
}

export async function disableWeather(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  db.runSync(`UPDATE prof_profile SET weather_enabled = 0, updated_at = ? WHERE user_id = ?`, [Date.now(), userId]);
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
  db.runSync(`INSERT INTO prof_messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?)`, [userId, role, content, Date.now()]);
}

export async function getProfMessages(db: SQLite.SQLiteDatabase, userId: string, limit: number = 50): Promise<ProfMessage[]> {
  return db.getAllSync<ProfMessage>(`SELECT * FROM prof_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT ?`, [userId, limit]);
}

export async function clearProfMessages(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  db.runSync('DELETE FROM prof_messages WHERE user_id = ?', [userId]);
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
  db.runSync(
    `INSERT INTO prof_schedule (user_id, day_of_week, start_time, end_time, subject, room, teacher, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [item.user_id, item.day_of_week, item.start_time, item.end_time, item.subject, item.room ?? null, item.teacher ?? null, Date.now()]
  );
}

export async function getSchedule(db: SQLite.SQLiteDatabase, userId: string, dayOfWeek?: number): Promise<ProfScheduleItem[]> {
  if (dayOfWeek !== undefined) {
    return db.getAllSync<ProfScheduleItem>(`SELECT * FROM prof_schedule WHERE user_id = ? AND day_of_week = ? ORDER BY start_time ASC`, [userId, dayOfWeek]);
  }
  return db.getAllSync<ProfScheduleItem>(`SELECT * FROM prof_schedule WHERE user_id = ? ORDER BY day_of_week ASC, start_time ASC`, [userId]);
}

export async function clearSchedule(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  db.runSync('DELETE FROM prof_schedule WHERE user_id = ?', [userId]);
}

// ============================================================
// ÉVÉNEMENTS + NOTES
// ============================================================

export interface ProfEvent {
  id?: number;
  user_id: string;
  type: 'controle' | 'devoir' | 'lecon';
  subject?: string;
  title: string;
  due_date: number;
  done: number;
  grade: number | null;
  grade_max: number | null;
  grade_at: number | null;
  grade_asked: number;
  created_at?: number;
}

export async function addProfEvent(db: SQLite.SQLiteDatabase, event: Omit<ProfEvent, 'id' | 'created_at' | 'done' | 'grade' | 'grade_max' | 'grade_at' | 'grade_asked'> & { done?: number }): Promise<void> {
  db.runSync(
    `INSERT INTO prof_events (user_id, type, subject, title, due_date, done, grade, grade_max, grade_at, grade_asked, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?)`,
    [event.user_id, event.type, event.subject ?? null, event.title, event.due_date, event.done ?? 0, Date.now()]
  );
}

export async function getUpcomingEvents(db: SQLite.SQLiteDatabase, userId: string, limit: number = 20): Promise<ProfEvent[]> {
  return db.getAllSync<ProfEvent>(`SELECT * FROM prof_events WHERE user_id = ? AND done = 0 AND due_date >= ? ORDER BY due_date ASC LIMIT ?`, [userId, Date.now(), limit]);
}

export async function getEventsForDate(db: SQLite.SQLiteDatabase, userId: string, date: Date): Promise<ProfEvent[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return db.getAllSync<ProfEvent>(
    `SELECT * FROM prof_events WHERE user_id = ? AND done = 0 AND due_date BETWEEN ? AND ? ORDER BY due_date ASC`,
    [userId, startOfDay.getTime(), endOfDay.getTime()]
  );
}

export async function getEventsAwaitingGrade(db: SQLite.SQLiteDatabase, userId: string): Promise<ProfEvent[]> {
  const now = Date.now();
  const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
  const fourDaysAgo = now - 4 * 24 * 60 * 60 * 1000;

  return db.getAllSync<ProfEvent>(
    `SELECT * FROM prof_events
     WHERE user_id = ?
       AND type = 'controle'
       AND done = 0
       AND due_date BETWEEN ? AND ?
       AND grade IS NULL
       AND grade_asked = 0
     ORDER BY due_date ASC
     LIMIT 3`,
    [userId, fourDaysAgo, twoDaysAgo]
  );
}

export async function markGradeAsked(db: SQLite.SQLiteDatabase, eventId: number): Promise<void> {
  db.runSync('UPDATE prof_events SET grade_asked = 1 WHERE id = ?', [eventId]);
}

export async function saveEventGrade(db: SQLite.SQLiteDatabase, eventId: number, grade: number, gradeMax: number): Promise<void> {
  db.runSync(
    `UPDATE prof_events SET grade = ?, grade_max = ?, grade_at = ?, done = 1 WHERE id = ?`,
    [grade, gradeMax, Date.now(), eventId]
  );
}

export async function getEventsWithGrades(db: SQLite.SQLiteDatabase, userId: string): Promise<ProfEvent[]> {
  return db.getAllSync<ProfEvent>(
    `SELECT * FROM prof_events
     WHERE user_id = ? AND grade IS NOT NULL
     ORDER BY grade_at DESC
     LIMIT 50`,
    [userId]
  );
}

export async function markEventDone(db: SQLite.SQLiteDatabase, eventId: number): Promise<void> {
  db.runSync('UPDATE prof_events SET done = 1 WHERE id = ?', [eventId]);
}

export async function deleteProfEvent(db: SQLite.SQLiteDatabase, eventId: number): Promise<void> {
  db.runSync('DELETE FROM prof_events WHERE id = ?', [eventId]);
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
  const existing = db.getFirstSync<ProfTopic>(`SELECT * FROM prof_topics WHERE user_id = ? AND subject = ? AND topic = ?`, [userId, subject, topic]);

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
    db.runSync(
      `UPDATE prof_topics SET status = ?, review_stage = ?, next_review_at = ?, times_seen = times_seen + 1, times_success = times_success + ?, last_seen = ? WHERE id = ?`,
      [newStatus, newStage, nextReview, result === 'success' ? 1 : 0, now, existing.id]
    );
  } else {
    const stage = result === 'success' ? 1 : 0;
    const status: ProfTopic['status'] = result === 'success' ? 'in_progress' : 'fragile';
    const nextReview = computeNextReviewAt(stage);
    db.runSync(
      `INSERT INTO prof_topics (user_id, subject, topic, status, review_stage, next_review_at, times_seen, times_success, last_seen, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [userId, subject, topic, status, stage, nextReview, result === 'success' ? 1 : 0, now, now]
    );
  }
}

export async function getAllTopics(db: SQLite.SQLiteDatabase, userId: string): Promise<ProfTopic[]> {
  return db.getAllSync<ProfTopic>(`SELECT * FROM prof_topics WHERE user_id = ? ORDER BY subject ASC, last_seen DESC`, [userId]);
}

export async function getTopicsToReview(db: SQLite.SQLiteDatabase, userId: string): Promise<ProfTopic[]> {
  return db.getAllSync<ProfTopic>(`SELECT * FROM prof_topics WHERE user_id = ? AND next_review_at <= ? AND status != 'acquired' ORDER BY next_review_at ASC LIMIT 5`, [userId, Date.now()]);
}

export async function getFragileTopics(db: SQLite.SQLiteDatabase, userId: string): Promise<ProfTopic[]> {
  return db.getAllSync<ProfTopic>(`SELECT * FROM prof_topics WHERE user_id = ? AND status = 'fragile' ORDER BY last_seen ASC LIMIT 3`, [userId]);
}

export async function deleteTopic(db: SQLite.SQLiteDatabase, topicId: number): Promise<void> {
  db.runSync('DELETE FROM prof_topics WHERE id = ?', [topicId]);
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
  last_weather_refusal_prompt_at: number | null;
  updated_at: number;
}

export async function getProfState(db: SQLite.SQLiteDatabase, userId: string): Promise<ProfState> {
  let state = db.getFirstSync<ProfState>('SELECT * FROM prof_state WHERE user_id = ?', [userId]);

  if (!state) {
    const now = Date.now();
    db.runSync(`INSERT OR IGNORE INTO prof_state (user_id, updated_at) VALUES (?, ?)`, [userId, now]);
    state = db.getFirstSync<ProfState>('SELECT * FROM prof_state WHERE user_id = ?', [userId]);
    if (!state) {
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
        last_weather_refusal_prompt_at: null,
        updated_at: now,
      };
    }
  }

  return state;
}

export async function markReviewOffered(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  const now = Date.now();
  db.runSync(
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
  db.runSync(
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
  db.runSync(
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
  db.runSync(
    `UPDATE prof_state SET morning_briefing_enabled = 0, morning_briefing_notification_id = NULL, updated_at = ? WHERE user_id = ?`,
    [Date.now(), userId]
  );
}

export async function markEveningBriefingSent(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  const now = Date.now();
  db.runSync(
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
  db.runSync(
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
  db.runSync(
    `UPDATE prof_state SET evening_briefing_hour = ?, evening_briefing_minute = ?, updated_at = ? WHERE user_id = ?`,
    [hour, minute, Date.now(), userId]
  );
}

export async function disableEveningBriefing(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  db.runSync(
    `UPDATE prof_state SET evening_briefing_enabled = 0, evening_briefing_notification_id = NULL, updated_at = ? WHERE user_id = ?`,
    [Date.now(), userId]
  );
}

export async function markWeatherRefusalPrompted(db: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  const now = Date.now();
  db.runSync(
    `INSERT INTO prof_state (user_id, last_weather_refusal_prompt_at, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET last_weather_refusal_prompt_at = excluded.last_weather_refusal_prompt_at, updated_at = excluded.updated_at`,
    [userId, now, now]
  );
}

// ============================================================
// 🆕 MÉMOIRE LONGUE — RÉSUMÉS DE CONVERSATIONS
// ============================================================

export interface ProfSummary {
  id?: number;
  user_id: string;
  summary: string;
  messages_count: number;
  period_start: number;
  period_end: number;
  created_at: number;
}

export async function saveSummary(
  db: SQLite.SQLiteDatabase,
  userId: string,
  summary: string,
  messagesCount: number,
  periodStart: number,
  periodEnd: number
): Promise<void> {
  db.runSync(
    `INSERT INTO prof_summaries (user_id, summary, messages_count, period_start, period_end, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, summary, messagesCount, periodStart, periodEnd, Date.now()]
  );
}

export async function getRecentSummaries(
  db: SQLite.SQLiteDatabase,
  userId: string,
  limit: number = 3
): Promise<ProfSummary[]> {
  return db.getAllSync<ProfSummary>(
    `SELECT * FROM prof_summaries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
}

export async function countSummaries(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<number> {
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM prof_summaries WHERE user_id = ?`,
    [userId]
  );
  return row?.count ?? 0;
}

/**
 * Détecte si on doit générer un nouveau résumé.
 * Déclenchement : tous les 30 messages OU toutes les 24h.
 */
export async function shouldGenerateSummary(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<boolean> {
  try {
    const lastSummary = db.getFirstSync<{ period_end: number; messages_count: number }>(
      `SELECT period_end, messages_count FROM prof_summaries WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    // Compter les messages depuis le dernier résumé
    const since = lastSummary ? lastSummary.period_end : 0;
    const countRow = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM prof_messages WHERE user_id = ? AND created_at > ?`,
      [userId, since]
    );
    const messageCount = countRow?.count ?? 0;

    // Déclencheur 1 : 30 messages ou plus depuis le dernier résumé
    if (messageCount >= 30) return true;

    // Déclencheur 2 : 24h depuis le dernier résumé (avec au moins 10 messages)
    if (lastSummary) {
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (lastSummary.period_end < twentyFourHoursAgo && messageCount >= 10) return true;
    }

    return false;
  } catch (e) {
    console.warn('[Prof DB] shouldGenerateSummary échoué:', e);
    return false;
  }
}

/**
 * Récupère les messages à résumer (depuis le dernier résumé).
 */
export async function getMessagesToSummarize(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<ProfMessage[]> {
  const lastSummary = db.getFirstSync<{ period_end: number }>(
    `SELECT period_end FROM prof_summaries WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  const since = lastSummary ? lastSummary.period_end : 0;

  return db.getAllSync<ProfMessage>(
    `SELECT * FROM prof_messages WHERE user_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 50`,
    [userId, since]
  );
}

// ============================================================
// 🆕 MÉMOIRE LONGUE — COMPORTEMENTS APPRIS
// ============================================================

export interface ProfLearnedPattern {
  id?: number;
  user_id: string;
  category: string;
  pattern: string;
  confidence: number;
  times_observed: number;
  created_at: number;
  updated_at: number;
}

export async function saveLearnedPattern(
  db: SQLite.SQLiteDatabase,
  userId: string,
  category: string,
  pattern: string
): Promise<void> {
  const now = Date.now();

  const existing = db.getFirstSync<ProfLearnedPattern>(
    `SELECT * FROM prof_learned_patterns WHERE user_id = ? AND category = ? AND pattern = ?`,
    [userId, category, pattern]
  );

  if (existing && existing.id !== undefined) {
    // Incrémenter la confiance et le nombre d'observations
    db.runSync(
      `UPDATE prof_learned_patterns
       SET confidence = MIN(confidence + 1, 5),
           times_observed = times_observed + 1,
           updated_at = ?
       WHERE id = ?`,
      [now, existing.id]
    );
  } else {
    db.runSync(
      `INSERT INTO prof_learned_patterns (user_id, category, pattern, confidence, times_observed, created_at, updated_at)
       VALUES (?, ?, ?, 1, 1, ?, ?)`,
      [userId, category, pattern, now, now]
    );
  }
}

export async function getLearnedPatterns(
  db: SQLite.SQLiteDatabase,
  userId: string,
  limit: number = 5
): Promise<ProfLearnedPattern[]> {
  return db.getAllSync<ProfLearnedPattern>(
    `SELECT * FROM prof_learned_patterns
     WHERE user_id = ?
     ORDER BY confidence DESC, times_observed DESC
     LIMIT ?`,
    [userId, limit]
  );
}

// ============================================================
// 🆕 MÉMOIRE LONGUE — CONSTRUCTION DU CONTEXTE
// ============================================================

/**
 * Construit le contexte mémoire à injecter dans le prompt Prof.
 * Format compact (~400 tokens max).
 */
export async function buildMemoryContext(
  db: SQLite.SQLiteDatabase,
  userId: string
): Promise<string> {
  try {
    const parts: string[] = [];

    // 1. Profil de l'enfant (déjà utilisé ailleurs, mais on le rappelle)
    const profile = await getProfProfile(db, userId);
    if (profile && profile.child_name && profile.child_name !== 'Enfant') {
      parts.push(`**Profil** : ${profile.child_name}, ${profile.child_age} ans, en ${profile.child_grade}.`);
    }

    // 2. Notions récentes à revoir
    const topicsToReview = await getTopicsToReview(db, userId);
    if (topicsToReview.length > 0) {
      const lines = topicsToReview.map((t) => `- ${t.subject} : ${t.topic} (${t.status})`);
      parts.push(`**À revoir** :\n${lines.join('\n')}`);
    }

    // 3. Derniers résumés de conversation
    const summaries = await getRecentSummaries(db, userId, 3);
    if (summaries.length > 0) {
      const lines = summaries.map((s) => `- ${s.summary}`);
      parts.push(`**Historique récent** :\n${lines.join('\n')}`);
    }

    // 4. Comportements appris
    const patterns = await getLearnedPatterns(db, userId, 5);
    if (patterns.length > 0) {
      const lines = patterns.map((p) => `- [${p.category}] ${p.pattern}`);
      parts.push(`**Ce que tu as appris sur lui** :\n${lines.join('\n')}`);
    }

    if (parts.length === 0) return '';

    return `## 🧠 MÉMOIRE LONGUE (ce que tu sais déjà sur cet enfant)\n\n${parts.join('\n\n')}\n`;
  } catch (e) {
    console.warn('[Prof DB] buildMemoryContext échoué:', e);
    return '';
  }
}