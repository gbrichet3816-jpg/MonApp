import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';
import JSZip from 'jszip';

const db = SQLite.openDatabaseSync('monapp.db');

export async function exportBackup(): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const zip = new JSZip();

    const messages = db.getAllSync('SELECT * FROM messages');
    const reminders = db.getAllSync('SELECT * FROM reminders');
    const documents = db.getAllSync('SELECT * FROM documents');
    const userProfile = db.getAllSync('SELECT * FROM user_profile');
    const friendNicknames = db.getAllSync('SELECT * FROM friend_nicknames');

    const backupData = {
      version: 1,
      exportedAt: Date.now(),
      data: {
        messages,
        reminders,
        documents,
        userProfile,
        friendNicknames,
      },
    };

    zip.file('backup.json', JSON.stringify(backupData, null, 2));

    const zipContent = await zip.generateAsync({ type: 'base64' });

    const docDir = (FileSystem as any).documentDirectory;
    if (!docDir) return { success: false, error: 'Dossier introuvable' };

    const date = new Date();
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const fileName = `agents_backup_${dateStr}.zip`;
    const filePath = `${docDir}${fileName}`;

    await (FileSystem as any).writeAsStringAsync(filePath, zipContent, {
      encoding: 'base64',
    });

    return { success: true, path: filePath };
  } catch (error) {
    console.error('Erreur export:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

export async function shareBackup(): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await exportBackup();
    if (!result.success || !result.path) {
      return { success: false, error: result.error };
    }

    if (!(await Sharing.isAvailableAsync())) {
      return { success: false, error: 'Partage non disponible' };
    }

    await Sharing.shareAsync(result.path, {
      mimeType: 'application/zip',
      dialogTitle: 'Sauvegarder mes données',
      UTI: 'public.zip-archive',
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur partage backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

export async function pickBackupFile(): Promise<{
  success: boolean;
  filePath?: string;
  error?: string;
}> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/zip',
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return { success: false, error: 'Annulé' };
    }

    if (!result.assets || result.assets.length === 0) {
      return { success: false, error: 'Aucun fichier sélectionné' };
    }

    return { success: true, filePath: result.assets[0].uri };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur sélection',
    };
  }
}

export async function importBackup(filePath: string): Promise<{
  success: boolean;
  stats?: {
    messages: number;
    reminders: number;
    documents: number;
    hasProfile: boolean;
  };
  error?: string;
}> {
  try {
    const zipContent = await (FileSystem as any).readAsStringAsync(filePath, {
      encoding: 'base64',
    });

    const zip = await JSZip.loadAsync(zipContent, { base64: true });

    const backupFile = zip.file('backup.json');
    if (!backupFile) {
      return { success: false, error: 'Fichier de sauvegarde invalide' };
    }

    const backupText = await backupFile.async('string');
    const backupData = JSON.parse(backupText);

    if (!backupData.data) {
      return { success: false, error: 'Format de sauvegarde invalide' };
    }

    const { messages, reminders, documents, userProfile, friendNicknames } = backupData.data;

    db.execSync(`
      DELETE FROM messages;
      DELETE FROM reminders;
      DELETE FROM documents;
      DELETE FROM user_profile;
      DELETE FROM friend_nicknames;
    `);

    if (messages && Array.isArray(messages)) {
      messages.forEach((m: any) => {
        db.runSync(
          'INSERT OR REPLACE INTO messages (id, agent_id, text, is_user, created_at) VALUES (?, ?, ?, ?, ?)',
          [m.id, m.agent_id, m.text, m.is_user, m.created_at],
        );
      });
    }

    if (reminders && Array.isArray(reminders)) {
      reminders.forEach((r: any) => {
        db.runSync(
          'INSERT OR REPLACE INTO reminders (id, agent_id, medication_name, time, notification_id, active, created_at, last_fired_at, response) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            r.id,
            r.agent_id,
            r.medication_name,
            r.time,
            r.notification_id,
            r.active,
            r.created_at,
            r.last_fired_at,
            r.response,
          ],
        );
      });
    }

    if (documents && Array.isArray(documents)) {
      documents.forEach((d: any) => {
        db.runSync(
          'INSERT OR REPLACE INTO documents (id, agent_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)',
          [d.id, d.agent_id, d.title, d.content, d.created_at],
        );
      });
    }

    if (userProfile && Array.isArray(userProfile) && userProfile.length > 0) {
      const p = userProfile[0];
      db.runSync(
        'INSERT OR REPLACE INTO user_profile (id, code, first_name, registered, created_at) VALUES (1, ?, ?, ?, ?)',
        [p.code, p.first_name, p.registered, p.created_at],
      );
    }

    if (friendNicknames && Array.isArray(friendNicknames)) {
      friendNicknames.forEach((n: any) => {
        db.runSync(
          'INSERT OR REPLACE INTO friend_nicknames (friend_code, nickname, updated_at) VALUES (?, ?, ?)',
          [n.friend_code, n.nickname, n.updated_at],
        );
      });
    }

    return {
      success: true,
      stats: {
        messages: messages?.length || 0,
        reminders: reminders?.length || 0,
        documents: documents?.length || 0,
        hasProfile: userProfile && userProfile.length > 0,
      },
    };
  } catch (error) {
    console.error('Erreur import:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}

export function wipeAllData() {
  db.execSync(`
    DELETE FROM messages;
    DELETE FROM reminders;
    DELETE FROM documents;
    DELETE FROM user_profile;
    DELETE FROM friend_nicknames;
  `);
}