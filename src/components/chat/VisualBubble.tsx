import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors, Fonts, Spacing } from '@/constants/theme';

type Props = {
  type: 'svg' | 'mermaid' | 'html';
  title: string;
  code: string;
};

function escapeForTemplate(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

function buildHtml(type: Props['type'], code: string): string {
  if (type === 'svg') {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #FFFFFF;
    width: 100%; overflow: hidden;
    font-family: -apple-system, sans-serif;
    touch-action: manipulation;
  }
  .svg-wrapper {
    width: 100%; padding: 16px;
    display: flex; justify-content: center; align-items: center;
  }
  .svg-wrapper svg { max-width: 100%; height: auto; display: block; }
</style>
</head>
<body>
  <div class="svg-wrapper" id="content">${code}</div>
  <script>
    function sendHeight() {
      var h = document.getElementById('content').scrollHeight;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
    }
    window.addEventListener('load', sendHeight);
    setTimeout(sendHeight, 300);
    setTimeout(sendHeight, 800);
  </script>
</body>
</html>`;
  }

  if (type === 'mermaid') {
    const safeCode = escapeForTemplate(code);
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #FFFFFF;
    width: 100%; overflow: hidden;
    font-family: -apple-system, sans-serif;
  }
  #content {
    padding: 12px; display: flex; justify-content: center;
    align-items: flex-start; width: 100%;
  }
  #content svg { max-width: 100%; height: auto; display: block; }
</style>
</head>
<body>
  <div id="content"><div class="mermaid" id="mermaid-container"></div></div>
  <script>
    function sendHeight() {
      var h = document.getElementById('content').scrollHeight;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
    }
    (function() {
      try {
        var mermaidCode = \`${safeCode}\`;
        mermaid.initialize({
          startOnLoad: false, theme: 'neutral', securityLevel: 'loose',
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
          timeline: { useMaxWidth: true }, mindmap: { useMaxWidth: true }
        });
        mermaid.render('mermaid-svg-' + Date.now(), mermaidCode).then(function(result) {
          document.getElementById('mermaid-container').innerHTML = result.svg;
          setTimeout(sendHeight, 100);
          setTimeout(sendHeight, 500);
        }).catch(function(err) {
          document.getElementById('mermaid-container').innerHTML = 
            '<pre style="color:#C62828;font-size:12px;white-space:pre-wrap;">Erreur Mermaid: ' + (err.message || err) + '</pre>';
          setTimeout(sendHeight, 200);
        });
      } catch (e) {
        document.getElementById('mermaid-container').innerHTML = 
          '<pre style="color:#C62828;font-size:12px;">Erreur: ' + e.message + '</pre>';
        setTimeout(sendHeight, 200);
      }
    })();
  </script>
</body>
</html>`;
  }

  // HTML brut
  return code;
}

export default function VisualBubble({ type, title, code }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [height, setHeight] = useState(200);
  const [zoomVisible, setZoomVisible] = useState(false);

  const htmlContent = buildHtml(type, code);

  // Version "zoomée" : même HTML mais on force un scale initial plus grand
  const zoomedHtml = type === 'html'
    ? code
    : htmlContent.replace(
        'maximum-scale=5.0',
        'maximum-scale=10.0 initial-scale=1.8'
      );

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => setZoomVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="expand-outline" size={18} color={Colors.light.background} />
          </TouchableOpacity>
        </View>
        <View style={[styles.webviewContainer, { height: Math.max(height, 120) }]}>
          <WebView
            originWhitelist={['*']}
            source={{ html: htmlContent }}
            style={styles.webview}
            onLoadEnd={() => setIsLoading(false)}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'height' && typeof data.value === 'number') {
                  setHeight(Math.ceil(data.value));
                }
              } catch {}
            }}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled
            bounces={false}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            scalesPageToFit
            setBuiltInZoomControls
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

      {/* MODAL ZOOM PLEIN ÉCRAN */}
      <Modal
        visible={zoomVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>{title}</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setZoomVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalWebviewContainer}>
            <WebView
              originWhitelist={['*']}
              source={{ html: zoomedHtml }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled
              bounces={false}
              scalesPageToFit
              setBuiltInZoomControls
              androidLayerType="software"
            />
          </View>
          <Text style={styles.modalHint}>
            Pince pour zoomer davantage • Touche ✕ pour fermer
          </Text>
        </View>
      </Modal>
    </>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.primary,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  title: {
    flex: 1,
    color: Colors.light.background,
    fontSize: 14,
    fontFamily: Fonts.semibold,
    fontWeight: '600',
    marginRight: Spacing.two,
  },
  zoomButton: {
    padding: 2,
  },
  webviewContainer: {
    width: '100%',
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
  // Modal zoom
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    paddingTop: 40,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  modalTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Fonts.semibold,
    fontWeight: '600',
    marginRight: 12,
  },
  modalClose: {
    padding: 4,
  },
  modalWebviewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  modalHint: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.7,
  },
});