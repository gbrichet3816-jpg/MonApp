import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Génère un PDF à partir d'un titre et d'un contenu texte
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

    // Convertit les sauts de ligne en <br> pour le HTML
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

// Ouvre le PDF dans le lecteur d'impression du téléphone
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

// Partage le PDF (email, WhatsApp, Drive…)
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