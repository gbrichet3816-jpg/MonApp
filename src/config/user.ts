import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('monapp.db');

const API_URL = 'https://monapp-server-production.up.railway.app';

export function initUserTable() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      code TEXT NOT NULL,
      first_name TEXT NOT NULL,
      registered INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friend_nicknames (
      friend_code TEXT PRIMARY KEY NOT NULL,
      nickname TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

export function getLocalProfile(): {
  code: string;
  firstName: string;
  registered: boolean;
} | null {
  const rows = db.getAllSync<{
    code: string;
    first_name: string;
    registered: number;
  }>('SELECT code, first_name, registered FROM user_profile WHERE id = 1');

  if (rows.length === 0) return null;

  return {
    code: rows[0].code,
    firstName: rows[0].first_name,
    registered: rows[0].registered === 1,
  };
}

export function generateCode(firstName: string): string {
  const clean = firstName
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '')
    .slice(0, 10);

  const digits = Math.floor(100000 + Math.random() * 900000).toString();

  return `${clean || 'USER'}-${digits}`;
}

export function saveLocalProfile({
  code,
  firstName,
  registered,
}: {
  code: string;
  firstName: string;
  registered: boolean;
}) {
  db.runSync(
    'INSERT OR REPLACE INTO user_profile (id, code, first_name, registered, created_at) VALUES (1, ?, ?, ?, ?)',
    [code, firstName, registered ? 1 : 0, Date.now()],
  );
}

export function markProfileRegistered() {
  db.runSync('UPDATE user_profile SET registered = 1 WHERE id = 1');
}

export async function registerOnServer({
  code,
  firstName,
  email,
}: {
  code: string;
  firstName: string;
  email?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, firstName, email }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || 'Erreur enregistrement' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur réseau',
    };
  }
}

export async function fetchFriendsFromServer(code: string): Promise<{
  success: boolean;
  friends?: { code: string; firstName: string; addedAt: number }[];
  error?: string;
}> {
  try {
    const response = await fetch(`${API_URL}/user/${code}`);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || 'Erreur serveur' };
    }

    const data = await response.json();
    return { success: true, friends: data.friends || [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur réseau',
    };
  }
}

export async function addFriendOnServer({
  myCode,
  friendCode,
}: {
  myCode: string;
  friendCode: string;
}): Promise<{ success: boolean; friend?: any; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/add-friend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myCode, friendCode }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || 'Erreur ajout ami' };
    }

    const data = await response.json();
    return { success: true, friend: data.friend };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur réseau',
    };
  }
}

export async function removeFriendOnServer({
  myCode,
  friendCode,
}: {
  myCode: string;
  friendCode: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/remove-friend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myCode, friendCode }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || 'Erreur suppression ami' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur réseau',
    };
  }
}

export function saveFriendNickname(friendCode: string, nickname: string) {
  db.runSync(
    'INSERT OR REPLACE INTO friend_nicknames (friend_code, nickname, updated_at) VALUES (?, ?, ?)',
    [friendCode, nickname, Date.now()],
  );
}

export function loadFriendNicknames(): Record<string, string> {
  const rows = db.getAllSync<{
    friend_code: string;
    nickname: string;
  }>('SELECT friend_code, nickname FROM friend_nicknames');

  const result: Record<string, string> = {};
  rows.forEach((r) => {
    result[r.friend_code] = r.nickname;
  });
  return result;
}

export function deleteFriendNickname(friendCode: string) {
  db.runSync('DELETE FROM friend_nicknames WHERE friend_code = ?', [friendCode]);
}

export async function shareDocumentWithFriends({
  fromCode,
  toCodes,
  title,
  content,
  fileData,
  fileType,
}: {
  fromCode: string;
  toCodes: string[];
  title: string;
  content?: string;
  fileData?: string;
  fileType?: string;
}): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/share-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromCode,
        toCodes,
        title,
        content,
        fileData,
        fileType,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || 'Erreur partage' };
    }

    const data = await response.json();
    return { success: true, count: data.documents?.length || 0 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur réseau',
    };
  }
}