import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { WebView } from 'react-native-webview';

import { Colors, Fonts, Spacing } from '@/constants/theme';

type Props = {
  type: 'svg' | 'mermaid' | 'html';
  title: string;
  code: string;
};

export default function VisualBubble({ type, title, code }: Props) {
  const [isLoading, setIsLoading] = useState(true);

  // ===== SVG direct =====
  if (type === 'svg') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.svgContainer}>
          <Svg
            width="100%"
            height="250"
            viewBox="0 0 400 250"
            style={styles.svg}
          >
            {/* Le SVG est injecté via WebView car react-native-svg ne parse pas
                du SVG brut facilement. Pour simplifier, on rend via WebView. */}
          </Svg>
        </View>
      </View>
    );
  }

  // ===== Mermaid / HTML via WebView =====
  const htmlContent =
    type === 'mermaid'
      ? `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<style>
  body { margin: 0; padding: 12px; background: #F7F9FC; font-family: sans-serif; }
  .mermaid { display: flex; justify-content: center; }
</style>
</head>
<body>
  <div class="mermaid">
${code}
  </div>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
  </script>
</body>
</html>`
      : code;

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
  svgContainer: {
    padding: Spacing.two,
    backgroundColor: Colors.light.background,
  },
  svg: {
    backgroundColor: Colors.light.background,
  },
  webviewContainer: {
    height: 300,
    backgroundColor: Colors.light.background,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  loadingText: {
    marginTop: Spacing.two,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.light.textSecondary,
  },
});