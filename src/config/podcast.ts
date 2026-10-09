// src/config/podcast.ts
// 🎙️ Génération de podcasts M4A via TTS local (expo-tts-file)

import * as FileSystem from 'expo-file-system/legacy';
import * as TTSEngine from 'expo-tts-file';

const PODCASTS_DIR = `${(FileSystem as any).documentDirectory}podcasts/`;

export interface PodcastOptions {
  text: string;        // Texte à synthétiser (script du podcast)
  title: string;       // Titre de la leçon (pour le nommage auto)
  language?: string;   // 'fr-FR' par défaut
  rate?: number;       // Vitesse (0.5 à 2.0) — 1.0 par défaut
  pitch?: number;      // Tonalité (0.5 à 2.0) — 1.0 par défaut
  timeoutMs?: number;  // Watchdog (60000 par défaut)
}

export interface PodcastResult {
  success: boolean;
  filePath?: string;   // Chemin final dans documentDirectory/podcasts/
  fileName?: string;   // Nom du fichier (ex: Podcast - Les fractions.m4a)
  durationMs?: number; // Durée en millisecondes
  error?: string;
}

/**
 * 🎙️ Crée le dossier podcasts/ s'il n'existe pas.
 */
export async function ensurePodcastsDir(): Promise<boolean> {
  try {
    const dirInfo = await (FileSystem as any).getInfoAsync(PODCASTS_DIR);
    if (!dirInfo.exists) {
      await (FileSystem as any).makeDirectoryAsync(PODCASTS_DIR, {
        intermediates: true,
      });
    }
    return true;
  } catch (e) {
    console.error('[Podcast] Erreur création dossier:', e);
    return false;
  }
}

/**
 * 🧹 Nettoie le titre pour en faire un nom de fichier safe.
 * Retire les caractères interdits, normalise les espaces, limite à 60 caractères.
 */
function sanitizeFileName(title: string): string {
  return title
    .replace(/[\/\\:*?"<>|]/g, '')       // Caractères interdits sur Android/iOS
    .replace(/\s+/g, ' ')                 // Espaces multiples → simple
    .replace(/^\.+/, '')                  // Pas de points en début
    .trim()
    .substring(0, 60)                     // Limite de longueur
    || 'Sans titre';                      // Fallback si vide
}

/**
 * 🎙️ Génère un podcast M4A à partir d'un texte.
 *
 * Étapes :
 * 1. Crée le dossier podcasts/
 * 2. Appelle expo-tts-file avec format: 'aac' → M4A
 * 3. Le fichier est d'abord écrit dans le cache du module TTS
 * 4. On le copie dans documentDirectory/podcasts/ avec un nom lisible
 * 5. On supprime le fichier temporaire du cache
 */
export async function generatePodcast(
  options: PodcastOptions,
): Promise<PodcastResult> {
  const {
    text,
    title,
    language = 'fr-FR',
    rate = 1.0,
    pitch = 1.0,
    timeoutMs = 120000, // 2 min : autorise les podcasts longs
  } = options;

  try {
    // Validation
    if (!text || !text.trim()) {
      return { success: false, error: 'Texte vide' };
    }

    // 1. Créer le dossier podcasts/
    const dirReady = await ensurePodcastsDir();
    if (!dirReady) {
      return { success: false, error: 'Impossible de créer le dossier podcasts/' };
    }

    // 2. Générer le M4A via TTS (fichier temporaire dans le cache du module)
    const ttsResult = await TTSEngine.synthesizeToFile(text, {
      language,
      rate,
      pitch,
      format: 'aac',        // → M4A sur Android et iOS
      timeoutMs,
    });

    if (!ttsResult?.uri) {
      return { success: false, error: 'TTS n\'a pas retourné d\'URI' };
    }

    // 3. Nom du fichier final
    const safeTitle = sanitizeFileName(title);
    const fileName = `Podcast - ${safeTitle}.m4a`;
    const destPath = `${PODCASTS_DIR}${fileName}`;

    // 4. Copier depuis le cache TTS vers documentDirectory/podcasts/
    // Si un fichier du même nom existe déjà, on le supprime d'abord.
    const existing = await (FileSystem as any).getInfoAsync(destPath);
    if (existing.exists) {
      await (FileSystem as any).deleteAsync(destPath, { idempotent: true });
    }

    await (FileSystem as any).copyAsync({
      from: ttsResult.uri,
      to: destPath,
    });

    // 5. Nettoyer le fichier temporaire du cache TTS
    try {
      await TTSEngine.deleteFile(ttsResult.uri);
    } catch (e) {
      console.warn('[Podcast] Impossible de supprimer le fichier cache:', e);
    }

    console.log('[Podcast] Généré:', destPath);
    return {
      success: true,
      filePath: destPath,
      fileName,
      durationMs: ttsResult.durationMs,
    };
  } catch (error: any) {
    console.error('[Podcast] Erreur génération:', error);

    // Messages d'erreur lisibles selon le type
    const message = error?.message || 'Erreur inconnue';
    if (message.includes('ERR_TTS_TIMEOUT')) {
      return { success: false, error: 'La génération a pris trop de temps' };
    }
    if (message.includes('ERR_TTS_CANCELLED')) {
      return { success: false, error: 'Génération annulée' };
    }
    return { success: false, error: message };
  }
}

/**
 * 🗑️ Supprime un podcast par son chemin.
 */
export async function deletePodcast(filePath: string): Promise<boolean> {
  try {
    const info = await (FileSystem as any).getInfoAsync(filePath);
    if (!info.exists) return true;
    await (FileSystem as any).deleteAsync(filePath, { idempotent: true });
    return true;
  } catch (e) {
    console.error('[Podcast] Erreur suppression:', e);
    return false;
  }
}

/**
 * 🧹 Vide tout le dossier podcasts/.
 */
export async function clearAllPodcasts(): Promise<number> {
  try {
    const info = await (FileSystem as any).getInfoAsync(PODCASTS_DIR);
    if (!info.exists) return 0;

    const files = await (FileSystem as any).readDirectoryAsync(PODCASTS_DIR);
    let count = 0;
    for (const file of files) {
      try {
        await (FileSystem as any).deleteAsync(`${PODCASTS_DIR}${file}`, {
          idempotent: true,
        });
        count++;
      } catch (e) {
        console.warn('[Podcast] Impossible de supprimer:', file);
      }
    }
    return count;
  } catch (e) {
    console.error('[Podcast] Erreur clearAll:', e);
    return 0;
  }
}

/**
 * 📋 Liste tous les podcasts existants.
 */
export async function listPodcasts(): Promise<
  { name: string; path: string; size: number }[]
> {
  try {
    const info = await (FileSystem as any).getInfoAsync(PODCASTS_DIR);
    if (!info.exists) return [];

    const files = await (FileSystem as any).readDirectoryAsync(PODCASTS_DIR);
    const result = [];

    for (const file of files) {
      if (!file.endsWith('.m4a')) continue;
      const path = `${PODCASTS_DIR}${file}`;
      try {
        const fileInfo = await (FileSystem as any).getInfoAsync(path);
        result.push({
          name: file,
          path,
          size: fileInfo.size || 0,
        });
      } catch (e) {
        // Ignore les fichiers inaccessibles
      }
    }
    return result;
  } catch (e) {
    console.error('[Podcast] Erreur listage:', e);
    return [];
  }
}