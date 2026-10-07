import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * 🎙️ Partage un fichier audio via le menu système (WhatsApp, Drive, mail…).
 * Ne génère PAS de PDF, envoie directement le .m4a.
 */
export async function shareAudioFile(
  filePath: string,
  title: string,
): Promise<boolean> {
  try {
    if (!filePath) return false;

    // Vérifie que le fichier existe
    const info = await (FileSystem as any).getInfoAsync(filePath);
    if (!info.exists) {
      console.warn('[Audio] Fichier introuvable:', filePath);
      return false;
    }

    if (!(await Sharing.isAvailableAsync())) {
      console.warn('[Audio] Partage non disponible sur cet appareil');
      return false;
    }

    await Sharing.shareAsync(filePath, {
      mimeType: 'audio/m4a',
      dialogTitle: `Partager "${title}"`,
      UTI: 'public.mpeg-4-audio',
    });

    return true;
  } catch (error) {
    console.error('[Audio] Erreur partage:', error);
    return false;
  }
}

/**
 * 🎙️ Enregistre un fichier audio dans documentDirectory (accessible via
 * "Fichiers" sur Android / iOS).
 */
export async function saveAudioToDevice(
  sourcePath: string,
  title: string,
): Promise<{ success: boolean; path?: string }> {
  try {
    if (!sourcePath) return { success: false };

    const info = await (FileSystem as any).getInfoAsync(sourcePath);
    if (!info.exists) {
      console.warn('[Audio] Source introuvable:', sourcePath);
      return { success: false };
    }

    const safeTitle = title
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .slice(0, 50);

    const timestamp = Date.now();
    const fileName = `${safeTitle}_${timestamp}.m4a`;

    const docDir = (FileSystem as any).documentDirectory;
    if (!docDir) return { success: false };

    const destPath = `${docDir}${fileName}`;

    await (FileSystem as any).copyAsync({
      from: sourcePath,
      to: destPath,
    });

    return { success: true, path: destPath };
  } catch (error) {
    console.error('[Audio] Erreur enregistrement:', error);
    return { success: false };
  }
}

/**
 * 🎙️ Enregistre plusieurs audios d'un coup.
 */
export async function saveMultipleAudios(
  items: { filePath: string; title: string }[],
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const item of items) {
    const result = await saveAudioToDevice(item.filePath, item.title);
    if (result.success) success++;
    else failed++;
  }

  return { success, failed };
}

/**
 * 🎙️ Partage plusieurs audios d'un coup (un par un).
 */
export async function shareMultipleAudios(
  items: { filePath: string; title: string }[],
): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;

    for (const item of items) {
      if (!item.filePath) continue;
      const info = await (FileSystem as any).getInfoAsync(item.filePath);
      if (!info.exists) continue;

      await Sharing.shareAsync(item.filePath, {
        mimeType: 'audio/m4a',
        dialogTitle: `Partager "${item.title}"`,
        UTI: 'public.mpeg-4-audio',
      });
    }
    return true;
  } catch (error) {
    console.error('[Audio] Erreur partage multiple:', error);
    return false;
  }
}