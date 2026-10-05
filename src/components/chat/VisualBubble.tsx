import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors, Fonts, Spacing } from '@/constants/theme';

type Props = {
  type: 'svg' | 'mermaid' | 'html';
  title: string;
  code: string;
};

// Échappe les caractères HTML dangereux (mais PAS les balises SVG)
function escapeForHtmlTemplate(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');
}

export default function VisualBubble({ type, title, code }: Props) {
  const [isLoading, setIsLoading] = useState(true);

  let htmlContent = '';

  if (type === 'svg') {
    // ⚠️ Injection DIRECTE dans le body : pas de JavaScript, pas de innerHTML
    // Le SVG est du XML pur, il ne casse pas le HTML s'il est bien formé.
    htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #FFFFFF;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .svg-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 12px;
  }
  .svg-wrapper svg {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    display: block;
  }
</style>
</head>
<body>
  <div class="svg-wrapper">
    ${code}
  </div>
</body>
</html>`;
  } else if (type === 'mermaid') {
    const safeCode = escapeForHtmlTemplate(code);
    htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 12px;
    background: #FFFFFF;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .mermaid {
    display: flex;
    justify-content: center;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="mermaid" id="mermaid-container"></div>
  <script>
    (function() {
      try {
        var mermaidCode = \`${safeCode}\`;
        document.getElementById('mermaid-container').textContent = mermaidCode;
        if (typeof mermaid !== 'undefined') {
          mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'loose' });
        }
      } catch (e) {
        document.getElementById('mermaid-container').innerHTML = 
          '<p style="color:red;">Erreur Mermaid: ' + e.message + '</p>';
      }
    })();
  </script>
</body>
</html>`;
  } else {
    htmlContent = code;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.webviewContainer}>
        <WebView
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.webview}
          onLoadEnd={() => setIsLoading(false)}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          scalesPageToFit={false}
          androidLayerType="software"
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
              <Text style={styles.loadingText}>Chargement du visuel…</Text>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.two,
    borderRadius: Spacing.two,
    overflow: 'hidden',
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  header: {
    backgroundColor: Colors.light.primary,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  title: {
    color: Colors.light.background,
    fontSize: 14,
    fontFamily: Fonts.semibold,
    fontWeight: '600',
  },
  webviewContainer: {
    height: 320,
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: Spacing.two,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.light.textSecondary,
  },
});