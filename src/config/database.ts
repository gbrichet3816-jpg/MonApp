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