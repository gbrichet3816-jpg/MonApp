import * as FileSystem from 'expo-file-system';

const DOCUMENTS_DIR = `${(FileSystem as any).documentDirectory}documents/`;

export async function ensureDocumentsDir() {
  try {
    const dirInfo = await (FileSystem as any).getInfoAsync(DOCUMENTS_DIR);
    if (!dirInfo.exists) {
      await (FileSystem as any).makeDirectoryAsync(DOCUMENTS_DIR, { intermediates: true });
    }
  } catch (e) {
    console.warn('Erreur création dossier documents:', e);
  }
}

export async function saveFileToDocuments(
  sourceUri: string,
  fileName: string,
): Promise<string | null> {
  try {
    await ensureDocumentsDir();

    const extension = fileName.split('.').pop() || 'bin';
    const safeName = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const destPath = `${DOCUMENTS_DIR}${safeName}`;

    await (FileSystem as any).copyAsync({
      from: sourceUri,
      to: destPath,
    });

    return destPath;
  } catch (e) {
    console.error('Erreur copie fichier:', e);
    return null;
  }
}

export async function deleteFileFromDocuments(filePath: string) {
  try {
    const info = await (FileSystem as any).getInfoAsync(filePath);
    if (info.exists) {
      await (FileSystem as any).deleteAsync(filePath);
    }
  } catch (e) {
    console.warn('Erreur suppression fichier:', e);
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const info = await (FileSystem as any).getInfoAsync(filePath);
    return info.exists;
  } catch (e) {
    return false;
  }
}
