import * as SQLite from 'expo-sqlite';

import { initUserTable } from './user';

// 🆕 On n'ouvre PAS la base au chargement du module
// On l'ouvre dans initDatabase() pour éviter les erreurs au 1er lancement
let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('monapp.db');
  }
  return db;
}

export function initDatabase() {
  try {
    // 🆕 Ouvre la base ici (pas au chargement)
    const database = getDb();

    // Désactiver WAL pour éviter les pertes de messages en kill brutal
    try {
      database.execSync('PRAGMA journal_mode = DELETE;');
      database.execSync('PRAGMA synchronous = FULL;');
    } catch (e) {
      console.warn('[DB] Erreur PRAGMA:', e);
    }

    database.execSync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY NOT NULL,
        agent_id TEXT NOT NULL,
        text TEXT NOT NULL,
        is_user INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_agent
        ON messages (agent_id, created_at);

      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY NOT NULL,
        agent_id TEXT NOT NULL,
        medication_name TEXT NOT NULL,
        time TEXT NOT NULL,
        notification_id TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        last_fired_at INTEGER,
        response TEXT,
        reminder_type TEXT DEFAULT 'daily',
        scheduled_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        agent_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        file_path TEXT,
        file_type TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_documents_agent
        ON documents (agent_id, created_at);
    `);

    // Migrations
    try { database.execSync('ALTER TABLE documents ADD COLUMN file_path TEXT'); } catch (e) {}
    try { database.execSync('ALTER TABLE documents ADD COLUMN file_type TEXT'); } catch (e) {}
    try { database.execSync('ALTER TABLE reminders ADD COLUMN reminder_type TEXT DEFAULT \'daily\''); } catch (e) {}
    try { database.execSync('ALTER TABLE reminders ADD COLUMN scheduled_at INTEGER'); } catch (e) {}

    initUserTable();
  } catch (e) {
    console.error('[DB] Erreur initDatabase:', e);
    throw e;
  }
}

export function checkpointDatabase() {
  // No-op : plus de PRAGMA wal_checkpoint
}

// ===== MESSAGES =====

export function saveMessage({
  id,
  agentId,
  text,
  isUser,
}: {
  id: string;
  agentId: string;
  text: string;
  isUser: boolean;
}) {
  const database = getDb();
  database.runSync(
    'INSERT OR REPLACE INTO messages (id, agent_id, text, is_user, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, agentId, text, isUser ? 1 : 0, Date.now()],
  );
}

/**
 * 🆕 Met à jour le texte d'un message existant (par son id).
 * Utile pour remplacer un placeholder "génération en cours" par le contenu final.
 * Si le message n'existe pas, cette fonction ne fait rien.
 */
export function updateMessageText(id: string, newText: string) {
  const database = getDb();
  database.runSync(
    'UPDATE messages SET text = ? WHERE id = ?',
    [newText, id],
  );
}

export function loadMessages(agentId: string) {
  const database = getDb();
  // 🆕 On prend les 100 DERNIERS messages, puis on les remet dans l'ordre chronologique
  // Avant : ORDER BY created_at ASC LIMIT 100 → prenait les 100 PLUS ANCIENS
  // Maintenant : sous-requête DESC LIMIT 100 → prend les 100 PLUS RÉCENTS, puis ASC
  const rows = database.getAllSync<{
    id: string;
    agent_id: string;
    text: string;
    is_user: number;
    created_at: number;
  }>(
    'SELECT * FROM (SELECT * FROM messages WHERE agent_id = ? ORDER BY created_at DESC LIMIT 100) ORDER BY created_at ASC',
    [agentId],
  );

  return rows.map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    text: row.text,
    isUser: row.is_user === 1,
  }));
}

export function clearMessages(agentId: string) {
  const database = getDb();
  database.runSync('DELETE FROM messages WHERE agent_id = ?', [agentId]);
}

export function clearAllMessages() {
  const database = getDb();
  database.runSync('DELETE FROM messages');
}

// ===== RAPPELS =====

export function saveReminder({
  id,
  agentId,
  medicationName,
  time,
  notificationId,
  reminderType = 'daily',
  scheduledAt,
}: {
  id: string;
  agentId: string;
  medicationName: string;
  time: string;
  notificationId: string;
  reminderType?: string;
  scheduledAt?: number;
}) {
  const database = getDb();
  database.runSync(
    'INSERT OR REPLACE INTO reminders (id, agent_id, medication_name, time, notification_id, active, created_at, reminder_type, scheduled_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)',
    [id, agentId, medicationName, time, notificationId, Date.now(), reminderType, scheduledAt || null],
  );
}

export function loadReminders(agentId: string) {
  const database = getDb();
  return database.getAllSync<{
    id: string;
    agent_id: string;
    medication_name: string;
    time: string;
    notification_id: string;
    active: number;
    created_at: number;
    last_fired_at: number | null;
    response: string | null;
    reminder_type: string;
    scheduled_at: number | null;
  }>('SELECT * FROM reminders WHERE agent_id = ? AND active = 1', [agentId]);
}

export function deactivateReminder(id: string) {
  const database = getDb();
  database.runSync('UPDATE reminders SET active = 0 WHERE id = ?', [id]);
}

export function deactivateRemindersByName(agentId: string, medicationName: string) {
  const database = getDb();
  database.runSync(
    'UPDATE reminders SET active = 0 WHERE agent_id = ? AND LOWER(medication_name) = LOWER(?)',
    [agentId, medicationName],
  );
}

export function deactivateAllReminders(agentId: string) {
  const database = getDb();
  database.runSync('UPDATE reminders SET active = 0 WHERE agent_id = ?', [agentId]);
}

export function clearReminders(agentId: string) {
  const database = getDb();
  database.runSync('DELETE FROM reminders WHERE agent_id = ?', [agentId]);
}

export function markReminderFired(id: string) {
  const database = getDb();
  database.runSync('UPDATE reminders SET last_fired_at = ? WHERE id = ?', [Date.now(), id]);
}

export function setReminderResponse(id: string, response: string) {
  const database = getDb();
  database.runSync('UPDATE reminders SET response = ? WHERE id = ?', [response, id]);
}

export function findRemindersToAsk(agentId: string) {
  const database = getDb();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const rows = database.getAllSync<{
    id: string;
    agent_id: string;
    medication_name: string;
    time: string;
    notification_id: string;
    active: number;
    created_at: number;
    last_fired_at: number | null;
    response: string | null;
    reminder_type: string;
    scheduled_at: number | null;
  }>('SELECT * FROM reminders WHERE agent_id = ? AND active = 1 AND response IS NULL', [agentId]);

  return rows.filter((r) => {
    if (r.reminder_type === 'relative' || r.reminder_type === 'onetime') {
      return r.scheduled_at !== null && r.scheduled_at <= Date.now() && r.last_fired_at === null;
    }

    const [h, m] = r.time.split(':').map(Number);
    const reminderMinutes = h * 60 + m;
    return reminderMinutes <= currentMinutes && r.last_fired_at === null;
  });
}

export function markRemindersAsAsked(ids: string[]) {
  if (ids.length === 0) return;
  const database = getDb();
  const now = Date.now();
  ids.forEach((id) => {
    database.runSync('UPDATE reminders SET last_fired_at = ? WHERE id = ?', [now, id]);
  });
}

// ===== PRÉFÉRENCES =====

export function savePreference(key: string, value: string) {
  const database = getDb();
  database.runSync(
    'INSERT OR REPLACE INTO preferences (key, value, updated_at) VALUES (?, ?, ?)',
    [key, value, Date.now()],
  );
}

export function loadPreference(key: string): string | null {
  const database = getDb();
  const rows = database.getAllSync<{ value: string }>(
    'SELECT value FROM preferences WHERE key = ?',
    [key],
  );
  return rows[0]?.value || null;
}

export function loadAllPreferences(): Record<string, string> {
  const database = getDb();
  const rows = database.getAllSync<{ key: string; value: string }>(
    'SELECT key, value FROM preferences',
  );
  const result: Record<string, string> = {};
  rows.forEach((r) => { result[r.key] = r.value; });
  return result;
}

// ===== DOCUMENTS =====

export type Document = {
  id: string;
  agentId: string;
  title: string;
  content: string;
  filePath: string | null;
  fileType: string | null;
  createdAt: number;
};

export function saveDocument({
  id,
  agentId,
  title,
  content,
  filePath,
  fileType,
}: {
  id: string;
  agentId: string;
  title: string;
  content: string;
  filePath?: string;
  fileType?: string;
}) {
  const database = getDb();
  database.runSync(
    'INSERT OR REPLACE INTO documents (id, agent_id, title, content, file_path, file_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, agentId, title, content, filePath || null, fileType || null, Date.now()],
  );
}

export function loadDocuments(): Document[] {
  const database = getDb();
  const rows = database.getAllSync<{
    id: string;
    agent_id: string;
    title: string;
    content: string;
    file_path: string | null;
    file_type: string | null;
    created_at: number;
  }>('SELECT * FROM documents ORDER BY created_at DESC');

  return rows.map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    content: row.content,
    filePath: row.file_path,
    fileType: row.file_type,
    createdAt: row.created_at,
  }));
}

/**
 * 🔍 Recherche dans les documents par titre, contenu ou agent.
 *
 * Insensible à la casse ET aux accents (grâce à un normalize côté JS).
 * Retourne un tableau vide si la query est vide.
 *
 * @param query - Le texte à rechercher
 * @param options - Filtres optionnels (agentId, fileType)
 */
export function searchDocuments(
  query: string,
  options?: {
    agentId?: string;
    fileType?: 'audio' | 'written' | 'all';
  },
): Document[] {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) return [];

  const database = getDb();

  // On construit la requête SQL dynamiquement selon les filtres
  let sql = 'SELECT * FROM documents WHERE 1=1';
  const params: any[] = [];

  // Recherche texte : on utilise LIKE sur les 3 colonnes
  // On normalise côté JS pour retirer les accents, mais SQLite LIKE est
  // insensible à la casse par défaut pour les caractères ASCII.
  const likePattern = `%${trimmedQuery}%`;
  sql += ' AND (LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(agent_id) LIKE ?)';
  params.push(likePattern, likePattern, likePattern);

  // Filtre par agent
  if (options?.agentId) {
    sql += ' AND agent_id = ?';
    params.push(options.agentId);
  }

  // Filtre par type de fichier
  if (options?.fileType === 'audio') {
    sql += " AND file_type LIKE 'audio/%'";
  } else if (options?.fileType === 'written') {
    sql += " AND (file_type IS NULL OR file_type NOT LIKE 'audio/%')";
  }

  sql += ' ORDER BY created_at DESC';

  const rows = database.getAllSync<{
    id: string;
    agent_id: string;
    title: string;
    content: string;
    file_path: string | null;
    file_type: string | null;
    created_at: number;
  }>(sql, params);

  return rows.map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    content: row.content,
    filePath: row.file_path,
    fileType: row.file_type,
    createdAt: row.created_at,
  }));
}

export function deleteDocument(id: string): string | null {
  const database = getDb();
  const rows = database.getAllSync<{ file_path: string | null }>(
    'SELECT file_path FROM documents WHERE id = ?',
    [id],
  );
  const filePath = rows[0]?.file_path || null;

  database.runSync('DELETE FROM documents WHERE id = ?', [id]);

  return filePath;
}