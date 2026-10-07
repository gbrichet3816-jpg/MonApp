import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import Pdf from 'react-native-pdf';
import { WebView } from 'react-native-webview';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { parseVisualMarker, stripVisualMarker } from '@/utils/visualParser';

type Props = {
  filePath: string | null;
  fileType: string | null;
  title: string;
  content: string;
};

// 🎯 Détecte un HTML complet (DOCTYPE ou beaucoup de balises HTML)
// → PRIORITÉ ABSOLUE : si détecté, TOUT passe en WebView
function detectFullHtml(text: string): string | null {
  if (!text) return null;

  const doctypeIdx = text.indexOf('<!DOCTYPE');
  if (doctypeIdx !== -1) {
    return text.substring(doctypeIdx).trim();
  }

  const htmlCount = (text.match(/<(h1|h2|h3|table|tr|td|div|section|article|ul|ol|p)\b/gi) || []).length;
  if (htmlCount >= 5) {
    return text.trim();
  }

  return null;
}

// Détecte un SVG ISOLÉ (pas dans du HTML)
function detectIsolatedSvg(text: string): string | null {
  if (!text) return null;
  if (detectFullHtml(text)) return null;

  const svgStart = text.indexOf('<svg');
  if (svgStart === -1) return null;
  const svgEnd = text.indexOf('</svg>', svgStart);
  if (svgEnd === -1) return null;
  return text.substring(svgStart, svgEnd + '</svg>'.length);
}

// Détecte un Mermaid ISOLÉ
function detectIsolatedMermaid(text: string): string | null {
  if (!text) return null;
  if (detectFullHtml(text)) return null;

  const keywords = [
    'flowchart ', 'flowchart\n', 'graph TD', 'graph LR', 'graph TB', 'graph BT',
    'timeline\n', 'timeline\r\n', 'mindmap\n', 'mindmap\r\n',
    'sequenceDiagram', 'classDiagram', 'stateDiagram', 'pie title', 'gantt',
  ];

  for (const kw of keywords) {
    const idx = text.indexOf(kw);
    if (idx === -1) continue;
    const after = text.substring(idx);
    const stopMatch = after.match(/\n(#{1,3} |---|\*\*[A-ZÉÈÀ]|```)/);
    const endIdx = stopMatch ? idx + stopMatch.index! : text.length;
    return text.substring(idx, endIdx).trim();
  }
  return null;
}

export default function DocumentViewer({ filePath, fileType, title, content }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [textFileContent, setTextFileContent] = useState<string | null>(null);

  const isImage = fileType?.startsWith('image/');
  const isPdf = fileType?.includes('pdf');
  const isAudio = fileType?.startsWith('audio/');
  const isText =
    fileType?.startsWith('text/') ||
    fileType?.includes('json') ||
    fileType === 'application/octet-stream';

  useEffect(() => {
    if (isText && filePath) loadTextFile();
  }, [filePath, isText]);

  const loadTextFile = async () => {
    if (!filePath) return;
    try {
      setIsLoading(true);
      const base64 = await (FileSystem as any).readAsStringAsync(filePath, {
        encoding: 'base64',
      });
      setTextFileContent(decodeBase64Utf8(base64));
      setError(null);
    } catch (e) {
      console.error('Erreur lecture fichier texte:', e);
      setError('Impossible de lire le fichier texte');
    } finally {
      setIsLoading(false);
    }
  };

  // ===== AUDIO =====
  if (isAudio && filePath) {
    return <AudioViewer filePath={filePath} title={title} />;
  }

  // ===== IMAGE =====
  if (isImage && filePath) {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri: filePath }}
          style={styles.fullImage}
          resizeMode="contain"
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => {
            setError('Impossible de charger l\'image');
            setIsLoading(false);
          }}
        />
        {isLoading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }

  // ===== PDF =====
  if (isPdf && filePath) {
    return (
      <View style={styles.container}>
        <Pdf
          source={{ uri: filePath, cache: true }}
          style={styles.pdf}
          onLoadComplete={(n) => { console.log(`PDF: ${n} pages`); setIsLoading(false); }}
          onError={() => { setError('Impossible de charger le PDF'); setIsLoading(false); }}
          onLoadProgress={(p) => { if (p === 1) setIsLoading(false); }}
          enablePaging={false}
          trustAllCerts={false}
        />
        {isLoading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
            <Text style={styles.loaderText}>Chargement du PDF...</Text>
          </View>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }

  // ===== TEXTE =====
  if (isText) {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loaderText}>Chargement...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.unknownContainer}>
          <Ionicons name="alert-circle" size={64} color={Colors.light.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }
    return <ContentRenderer content={textFileContent || content || '(vide)'} />;
  }

  // ===== CONTENU SANS FICHIER =====
  if (!fileType && content) {
    return <ContentRenderer content={content} />;
  }

  // ===== INCONNU =====
  return (
    <View style={styles.unknownContainer}>
      <Ionicons name="document" size={64} color={Colors.light.primary} />
      <Text style={styles.unknownTitle}>{title}</Text>
      <Text style={styles.unknownHint}>Ce type de fichier n'est pas encore lisible.</Text>
    </View>
  );
}

// ============================================================
// 🎙️ LECTEUR AUDIO
// ============================================================
function AudioViewer({ filePath, title }: { filePath: string; title: string }) {
  const player = useAudioPlayer({ uri: filePath });
  const status = useAudioPlayerStatus(player);
  const [hasPlayed, setHasPlayed] = useState(false);

  const currentSec = Math.floor(status.currentTime || 0);
  const totalSec = Math.floor(status.duration || 0);
  const progress = totalSec > 0 ? Math.min(1, currentSec / totalSec) : 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleTogglePlay = () => {
    try {
      if (status.playing) {
        player.pause();
      } else {
        if (status.didJustFinish || currentSec >= totalSec) {
          player.seekTo(0);
        }
        player.play();
        setHasPlayed(true);
      }
    } catch (e) {
      console.warn('[AudioViewer] play/pause:', e);
    }
  };

  const handleSeek = (direction: 'back' | 'forward') => {
    const delta = direction === 'back' ? -10 : 10;
    const next = Math.max(0, Math.min(totalSec, currentSec + delta));
    try {
      player.seekTo(next);
    } catch (e) {
      console.warn('[AudioViewer] seek:', e);
    }
  };

  return (
    <View style={audioStyles.container}>
      <View style={audioStyles.iconCircle}>
        <Ionicons name="mic" size={48} color={Colors.light.primary} />
      </View>

      <Text style={audioStyles.title} numberOfLines={2}>
        {title}
      </Text>

      <View style={audioStyles.timeline}>
        <Text style={audioStyles.timeText}>{formatTime(currentSec)}</Text>
        <View style={audioStyles.progressBar}>
          <View style={[audioStyles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={audioStyles.timeText}>{formatTime(totalSec)}</Text>
      </View>

      <View style={audioStyles.controls}>
        <TouchableOpacity
          style={audioStyles.skipButton}
          onPress={() => handleSeek('back')}
        >
          <Ionicons name="play-back" size={26} color={Colors.light.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={audioStyles.playButton} onPress={handleTogglePlay}>
          <Ionicons
            name={status.playing ? 'pause' : 'play'}
            size={36}
            color={Colors.light.background}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={audioStyles.skipButton}
          onPress={() => handleSeek('forward')}
        >
          <Ionicons name="play-forward" size={26} color={Colors.light.primary} />
        </TouchableOpacity>
      </View>

      {hasPlayed && status.didJustFinish && (
        <Text style={audioStyles.hintText}>✅ Lecture terminée</Text>
      )}
    </View>
  );
}

// ============================================================
// RENDERER DE CONTENU
// ============================================================
function ContentRenderer({ content }: { content: string }) {
  // 1️⃣ PRIORITÉ ABSOLUE : HTML complet (fiches de révision)
  const fullHtml = detectFullHtml(content);
  if (fullHtml) {
    return (
      <View style={styles.fullscreenContainer}>
        <FullscreenVisual type="html" title="Fiche" code={fullHtml} />
      </View>
    );
  }

  // 2️⃣ Marqueur __VISUAL__ (visuel généré par Prof)
  const visual = parseVisualMarker(content);
  if (visual) {
    const cleanContent = stripVisualMarker(content);
    return (
      <View style={styles.fullscreenContainer}>
        <FullscreenVisual type={visual.type} title={visual.title} code={visual.code} />
        {cleanContent ? (
          <ScrollView style={styles.textContainer} contentContainerStyle={styles.textContent}>
            <Markdown style={markdownStyles}>{cleanContent}</Markdown>
          </ScrollView>
        ) : null}
      </View>
    );
  }

  // 3️⃣ SVG isolé
  const svg = detectIsolatedSvg(content);
  if (svg) {
    return (
      <View style={styles.fullscreenContainer}>
        <FullscreenVisual type="svg" title="Schéma" code={svg} />
      </View>
    );
  }

  // 4️⃣ Mermaid isolé
  const mermaid = detectIsolatedMermaid(content);
  if (mermaid) {
    return (
      <View style={styles.fullscreenContainer}>
        <FullscreenVisual type="mermaid" title="Diagramme" code={mermaid} />
      </View>
    );
  }

  // 5️⃣ Markdown normal
  return (
    <ScrollView style={styles.textContainer} contentContainerStyle={styles.textContent}>
      <Markdown style={markdownStyles}>{content}</Markdown>
    </ScrollView>
  );
}

// ============================================================
// Rendu plein écran
// ============================================================
function FullscreenVisual({
  type,
  title,
  code,
}: {
  type: 'svg' | 'mermaid' | 'html';
  title: string;
  code: string;
}) {
  let htmlContent = '';

  if (type === 'svg') {
    htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; overflow: auto; -webkit-overflow-scrolling: touch; }
  .wrap { padding: 16px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .wrap svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
  <div class="wrap">${code}</div>
</body>
</html>`;
  } else if (type === 'mermaid') {
    const escaped = code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; overflow: auto; -webkit-overflow-scrolling: touch; }
  #content { padding: 16px; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }
  #content svg { max-width: 100%; height: auto; }
</style>
</head>
<body>
  <div id="content"><div class="mermaid" id="mermaid-container"></div></div>
  <script>
    (function() {
      try {
        var mermaidCode = \`${escaped}\`;
        mermaid.initialize({
          startOnLoad: false, theme: 'neutral', securityLevel: 'loose',
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
          timeline: { useMaxWidth: true }, mindmap: { useMaxWidth: true }
        });
        mermaid.render('m-svg-' + Date.now(), mermaidCode).then(function(r) {
          document.getElementById('mermaid-container').innerHTML = r.svg;
        }).catch(function(err) {
          document.getElementById('mermaid-container').innerHTML = 
            '<pre style="color:#C62828;padding:12px;white-space:pre-wrap;">Erreur Mermaid: ' + (err.message || err) + '</pre>';
        });
      } catch (e) {
        document.getElementById('mermaid-container').innerHTML = 
          '<pre style="color:#C62828;padding:12px;">Erreur: ' + e.message + '</pre>';
      }
    })();
  </script>
</body>
</html>`;
  } else {
    htmlContent = code;
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: htmlContent }}
      style={styles.fullscreenWebview}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled
      bounces={false}
      scalesPageToFit
      setBuiltInZoomControls
      androidLayerType="software"
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loaderText}>Chargement…</Text>
        </View>
      )}
    />
  );
}

// Décode le base64 en texte UTF-8
function decodeBase64Utf8(base64: string): string {
  try {
    const binaryString = (global as any).atob
      ? (global as any).atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    console.error('Erreur décodage base64:', e);
    return '';
  }
}

const markdownStyles = {
  body: { fontSize: 15, lineHeight: 23, fontFamily: Fonts.regular, color: Colors.light.text },
  strong: { fontFamily: Fonts.bold, fontWeight: '700' as const },
  em: { fontStyle: 'italic' as const, fontFamily: Fonts.regular },
  heading1: { fontSize: 22, fontFamily: Fonts.bold, fontWeight: '700' as const, color: Colors.light.primary, marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.light.border, paddingBottom: 4 },
  heading2: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: '700' as const, color: Colors.light.primary, marginTop: 14, marginBottom: 6 },
  heading3: { fontSize: 16, fontFamily: Fonts.semibold, fontWeight: '600' as const, color: Colors.light.text, marginTop: 10, marginBottom: 4 },
  bullet_list: { marginVertical: 6 },
  ordered_list: { marginVertical: 6 },
  list_item: { marginVertical: 3 },
  code_inline: { backgroundColor: '#F0F0F0', color: '#C7254E', paddingHorizontal: 5, borderRadius: 3, fontFamily: 'monospace', fontSize: 14 },
  fence: { backgroundColor: '#F5F5F5', padding: 10, borderRadius: 6, fontFamily: 'monospace', fontSize: 13, marginVertical: 8 },
  blockquote: { borderLeftWidth: 4, borderLeftColor: Colors.light.primary, paddingLeft: 12, paddingVertical: 4, fontStyle: 'italic' as const, color: Colors.light.textSecondary, marginVertical: 6, backgroundColor: Colors.light.backgroundElement },
  link: { color: Colors.light.primary, textDecorationLine: 'underline' as const },
  hr: { backgroundColor: Colors.light.border, height: 1, marginVertical: 12 },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  fullscreenContainer: { flex: 1, backgroundColor: Colors.light.background },
  fullscreenWebview: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.two, backgroundColor: '#FFFFFF' },
  fullImage: { flex: 1, width: '100%' },
  pdf: { flex: 1, width: '100%', backgroundColor: Colors.light.backgroundElement },
  loaderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', gap: Spacing.two },
  loaderText: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.light.textSecondary },
  errorText: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.light.error, textAlign: 'center', padding: Spacing.four },
  textContainer: { flex: 1, backgroundColor: Colors.light.background },
  textContent: { padding: Spacing.four },
  unknownContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.five, gap: Spacing.three },
  unknownTitle: { fontSize: 20, fontFamily: Fonts.semibold, fontWeight: '600' as const, color: Colors.light.text, textAlign: 'center' },
  unknownHint: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.light.textSecondary, fontStyle: 'italic' as const, textAlign: 'center' },
});

const audioStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.five,
    gap: Spacing.four,
    backgroundColor: Colors.light.background,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.light.backgroundElement,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.semibold,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: Spacing.two,
  },
  timeText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.light.textSecondary,
    minWidth: 36,
    textAlign: 'center',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.light.primary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  skipButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.backgroundElement,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
});