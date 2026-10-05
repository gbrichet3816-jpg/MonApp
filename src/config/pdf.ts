import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * 🎯 Détecte un HTML complet (fiche de révision, document HTML)
 * → Dans ce cas, on l'envoie TEL QUEL à expo-print
 */
function isFullHtml(content: string): boolean {
  if (!content) return false;
  // DOCTYPE complet
  if (content.indexOf('<!DOCTYPE') !== -1) return true;
  // Ou beaucoup de balises HTML structurantes
  const htmlCount = (content.match(/<(h1|h2|h3|table|tr|td|div|section|article|ul|ol|p|style)\b/gi) || []).length;
  return htmlCount >= 5;
}

/**
 * 🆕 A6 : Convertit du Markdown basique en HTML propre pour PDF.
 * ⚠️ À N'UTILISER QUE si le contenu N'EST PAS déjà du HTML complet.
 */
function markdownToHtml(content: string): string {
  // Échappe d'abord les caractères HTML
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Titres (# ## ###)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Gras (**texte**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italique (*texte*)
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Code inline (`texte`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Listes à puces (- item)
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Listes numérotées (1. item)
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Citations (> texte)
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Séparateurs (---)
  html = html.replace(/^---$/gm, '<hr/>');

  // Sauts de ligne restants
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');

  return `<p>${html}</p>`;
}

/**
 * 🎯 Construit le HTML final pour l'impression/PDF
 * - Si le contenu est du HTML complet → renvoyé TEL QUEL
 * - Sinon → emballé dans un template avec conversion Markdown
 */
function buildPrintHtml({
  title,
  content,
  agentId,
}: {
  title: string;
  content: string;
  agentId?: string;
}): string {
  // ✅ CAS 1 : fiche HTML complète → on envoie tel quel
  if (isFullHtml(content)) {
    return content;
  }

  // ✅ CAS 2 : contenu Markdown → on emballe dans un template
  const date = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const contentHtml = markdownToHtml(content);

  return `
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
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            border-bottom: 2px solid #2E6FB7;
            padding-bottom: 15px;
            margin-bottom: 30px;
          }
          .title {
            font-size: 26px;
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
          }
          h1 { font-size: 22px; color: #2E6FB7; margin-top: 24px; margin-bottom: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; }
          h2 { font-size: 18px; color: #2E6FB7; margin-top: 20px; margin-bottom: 8px; }
          h3 { font-size: 16px; color: #1A1A1A; margin-top: 14px; margin-bottom: 6px; }
          p { margin: 8px 0; }
          ul { margin: 8px 0; padding-left: 24px; }
          li { margin: 4px 0; }
          strong { color: #1A1A1A; font-weight: 700; }
          em { font-style: italic; color: #5A6472; }
          code { background: #F0F0F0; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 13px; color: #C7254E; }
          blockquote { border-left: 4px solid #2E6FB7; padding-left: 14px; padding-top: 4px; padding-bottom: 4px; margin: 12px 0; background: #F7F9FC; font-style: italic; color: #5A6472; }
          hr { border: none; border-top: 1px solid #E2E8F0; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #9CA3AF; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">${title}</h1>
          <div class="meta">${date}${agentId ? ` · ${agentId}` : ''}</div>
        </div>
        <div class="content">${contentHtml}</div>
        <div class="footer">Généré par Agents</div>
      </body>
    </html>
  `;
}

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
    const html = buildPrintHtml({ title, content, agentId });
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
    const html = buildPrintHtml({ title, content, agentId });
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

    const safeTitle = title
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .slice(0, 50);

    const timestamp = Date.now();
    const fileName = `${safeTitle}_${timestamp}.pdf`;

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

export async function shareMultiplePdfs(
  documents: { title: string; content: string; agentId: string }[],
): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return false;
    }

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