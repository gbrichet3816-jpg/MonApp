import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export async function generatePdf({
  title,
  content,
  agentId,
}: {
  title: string;
  content: string;
  agentId?: string;
}): Promise<string | null> {
  try {
    const date = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const contentHtml = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 40px;
              color: #1A1A1A;
              line-height: 1.6;
            }
            .header {
              border-bottom: 2px solid #2E6FB7;
              padding-bottom: 15px;
              margin-bottom: 30px;
            }
            .title {
              font-size: 24px;
              font-weight: 700;
              color: #2E6FB7;
              margin: 0;
            }
            .meta {
              font-size: 12px;
              color: #5A6472;
              margin-top: 8px;
            }
            .content {
              font-size: 14px;
              color: #1A1A1A;
              white-space: pre-wrap;
            }
            .footer {
              margin-top: 40px;
              padding-top: 15px;
              border-top: 1px solid #E2E8F0;
              font-size: 11px;
              color: #9CA3AF;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">${title}</h1>
            <div class="meta">
              ${date}${agentId ? ` · ${agentId}` : ''}
            </div>
          </div>
          <div class="content">${contentHtml}</div>
          <div class="footer">
            Généré par MonApp
          </div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    return null;
  }
}

export async function printPdf({
  title,
  content,
  agentId,
}: {
  title: string;
  content: string;
  agentId?: string;
}): Promise<boolean> {
  try {
    const date = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const contentHtml = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 40px;
              color: #1A1A1A;
              line-height: 1.6;
            }
            .header {
              border-bottom: 2px solid #2E6FB7;
              padding-bottom: 15px;
              margin-bottom: 30px;
            }
            .title {
              font-size: 24px;
              font-weight: 700;
              color: #2E6FB7;
              margin: 0;
            }
            .meta {
              font-size: 12px;
              color: #5A6472;
              margin-top: 8px;
            }
            .content {
              font-size: 14px;
              color: #1A1A1A;
              white-space: pre-wrap;
            }
            .footer {
              margin-top: 40px;
              padding-top: 15px;
              border-top: 1px solid #E2E8F0;
              font-size: 11px;
              color: #9CA3AF;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">${title}</h1>
            <div class="meta">
              ${date}${agentId ? ` · ${agentId}` : ''}
            </div>
          </div>
          <div class="content">${contentHtml}</div>
          <div class="footer">
            Généré par MonApp
          </div>
        </body>
      </html>
    `;

    await Print.printAsync({ html });
    return true;
  } catch (error) {
    console.error('Erreur impression:', error);
    return false;
  }
}

export async function sharePdf({
  title,
  content,
  agentId,
}: {
  title: string;
  content: string;
  agentId?: string;
}): Promise<boolean> {
  try {
    const uri = await generatePdf({ title, content, agentId });
    if (!uri) return false;

    if (!(await Sharing.isAvailableAsync())) {
      return false;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Partager "${title}"`,
      UTI: 'com.adobe.pdf',
    });

    return true;
  } catch (error) {
    console.error('Erreur partage:', error);
    return false;
  }
}

// Enregistre un PDF dans le stockage local du téléphone (Documents)
export async function savePdfToDevice({
  title,
  content,
  agentId,
}: {
  title: string;
  content: string;
  agentId?: string;
}): Promise<{ success: boolean; path?: string }> {
  try {
    const uri = await generatePdf({ title, content, agentId });
    if (!uri) return { success: false };

    // Nettoie le titre pour en faire un nom de fichier
    const safeTitle = title
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .slice(0, 50);

    const timestamp = Date.now();
    const fileName = `${safeTitle}_${timestamp}.pdf`;

    // Dossier de destination (Documents sur Android)
        // Dossier de destination (Documents sur Android)
    const docDir = (FileSystem as any).documentDirectory;
    if (!docDir) return { success: false };

    const destPath = `${docDir}${fileName}`;

    await (FileSystem as any).copyAsync({
      from: uri,
      to: destPath,
    });

    return { success: true, path: destPath };
  } catch (error) {
    console.error('Erreur enregistrement PDF:', error);
    return { success: false };
  }
}

// Enregistre plusieurs PDF d'un coup
export async function saveMultiplePdfs(
  documents: { title: string; content: string; agentId: string }[],
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const doc of documents) {
    const result = await savePdfToDevice({
      title: doc.title,
      content: doc.content,
      agentId: doc.agentId,
    });
    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

// Partage plusieurs PDF via le menu Android
export async function shareMultiplePdfs(
  documents: { title: string; content: string; agentId: string }[],
): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return false;
    }

    // Pour l'instant, on partage un par un
    // (Android ne supporte pas le partage multiple natif facilement)
    for (const doc of documents) {
      const uri = await generatePdf({
        title: doc.title,
        content: doc.content,
        agentId: doc.agentId,
      });
      if (!uri) continue;

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Partager "${doc.title}"`,
        UTI: 'com.adobe.pdf',
      });
    }

    return true;
  } catch (error) {
    console.error('Erreur partage multiple:', error);
    return false;
  }
}