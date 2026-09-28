import * as SQLite from 'expo-sqlite';

// Ouvre (ou crée) la base de données locale
const db = SQLite.openDatabaseSync('monapp.db');

// Initialise la base : crée les tables si elles n'existent pas
export function initDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      agent_id TEXT NOT NULL,
      text TEXT NOT NULL,
      is_user INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_agent
      ON messages (agent_id, created_at);
  `);

  initRemindersTable();
}

// Sauvegarde un message dans la base
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
  db.runSync(
    'INSERT OR REPLACE INTO messages (id, agent_id, text, is_user, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, agentId, text, isUser ? 1 : 0, Date.now()],
  );
}

// Charge les messages d'un agent (les 50 plus récents)
export function loadMessages(agentId: string) {
  const rows = db.getAllSync<{
    id: string;
    agent_id: string;
    text: string;
    is_user: number;
    created_at: number;
  }>(
    'SELECT * FROM messages WHERE agent_id = ? ORDER BY created_at ASC LIMIT 50',
    [agentId],
  );

  return rows.map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    text: row.text,
    isUser: row.is_user === 1,
  }));
}

// Efface toutes les conversations d'un agent
export function clearMessages(agentId: string) {
  db.runSync('DELETE FROM messages WHERE agent_id = ?', [agentId]);
}

// Efface TOUTES les conversations (tous agents confondus)
export function clearAllMessages() {
  db.runSync('DELETE FROM messages');
}
// Table des rappels de médicaments
export function initRemindersTable() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY NOT NULL,
      agent_id TEXT NOT NULL,
      medication_name TEXT NOT NULL,
      time TEXT NOT NULL,
      notification_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
  `);
}

// Sauvegarde un rappel
export function saveReminder({
  id,
  agentId,
  medicationName,
  time,
  notificationId,
}: {
  id: string;
  agentId: string;
  medicationName: string;
  time: string;
  notificationId: string;
}) {
  db.runSync(
    'INSERT OR REPLACE INTO reminders (id, agent_id, medication_name, time, notification_id, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
    [id, agentId, medicationName, time, notificationId, Date.now()],
  );
}

// Charge les rappels actifs d'un agent
export function loadReminders(agentId: string) {
  return db.getAllSync<{
    id: string;
    agent_id: string;
    medication_name: string;
    time: string;
    notification_id: string;
    active: number;
    created_at: number;
  }>('SELECT * FROM reminders WHERE agent_id = ? AND active = 1', [agentId]);
}

// Désactive un rappel
export function deactivateReminder(id: string) {
  db.runSync('UPDATE reminders SET active = 0 WHERE id = ?', [id]);
}

// Efface tous les rappels d'un agent
export function clearReminders(agentId: string) {
  db.runSync('DELETE FROM reminders WHERE agent_id = ?', [agentId]);
}