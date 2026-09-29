import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('monapp.db');

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

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY NOT NULL,
      agent_id TEXT NOT NULL,
      medication_name TEXT NOT NULL,
      time TEXT NOT NULL,
      notification_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminder_responses (
      id TEXT PRIMARY KEY NOT NULL,
      reminder_id TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY NOT NULL,
      agent_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_agent
      ON documents (agent_id, created_at);
  `);
}

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

export function clearMessages(agentId: string) {
  db.runSync('DELETE FROM messages WHERE agent_id = ?', [agentId]);
}

export function clearAllMessages() {
  db.runSync('DELETE FROM messages');
}

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

export function deactivateReminder(id: string) {
  db.runSync('UPDATE reminders SET active = 0 WHERE id = ?', [id]);
}

export function clearReminders(agentId: string) {
  db.runSync('DELETE FROM reminders WHERE agent_id = ?', [agentId]);
}

export function saveReminderResponse({
  reminderId,
  response,
}: {
  reminderId: string;
  response: string;
}) {
  db.runSync(
    'INSERT INTO reminder_responses (id, reminder_id, response, created_at) VALUES (?, ?, ?, ?)',
    [`${reminderId}-${Date.now()}`, reminderId, response, Date.now()],
  );
}

export function loadReminderResponses(reminderId: string) {
  return db.getAllSync<{
    id: string;
    reminder_id: string;
    response: string;
    created_at: number;
  }>('SELECT * FROM reminder_responses WHERE reminder_id = ? ORDER BY created_at DESC', [
    reminderId,
  ]);
}

export type Document = {
  id: string;
  agentId: string;
  title: string;
  content: string;
  createdAt: number;
};

export function saveDocument({
  id,
  agentId,
  title,
  content,
}: {
  id: string;
  agentId: string;
  title: string;
  content: string;
}) {
  db.runSync(
    'INSERT OR REPLACE INTO documents (id, agent_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, agentId, title, content, Date.now()],
  );
}

export function loadDocuments(): Document[] {
  const rows = db.getAllSync<{
    id: string;
    agent_id: string;
    title: string;
    content: string;
    created_at: number;
  }>('SELECT * FROM documents ORDER BY created_at DESC');

  return rows.map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export function deleteDocument(id: string) {
  db.runSync('DELETE FROM documents WHERE id = ?', [id]);
}