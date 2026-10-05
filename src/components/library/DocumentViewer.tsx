import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import Pdf from 'react-native-pdf';

import VisualBubble from '@/components/chat/VisualBubble';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { parseVisualMarker, stripVisualMarker } from '@/utils/visualParser';

type Props = {
  filePath: string | null;
  fileType: string | null;
  title: string;
  content: string;
};

// 🆕 Détecte un SVG brut dans un texte
function detectRawSvg(text: string): { svg: string; before: string; after: string } | null {
  if (!text) return null;

  const svgStart = text.indexOf('<svg');
  if (svgStart === -1) return null;

  const svgEnd = text.indexOf('</svg>', svgStart);
  if (svgEnd === -1) return null;

  const svg = text.substring(svgStart, svgEnd + '</svg>'.length);
  const before = text.substring(0, svgStart).trim();
  const after = text.substring(svgEnd + '</svg>'.length).trim();

  return { svg, before, after };
}

export default function DocumentViewer({ filePath, fileType, title, content }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [textFileContent, setTextFileContent] = useState<string | null>(null);

  const isImage = fileType?.startsWith('image/');
  const isPdf = fileType?.includes('pdf');
  const isText =
    fileType?.startsWith('text/') ||
    fileType?.includes('json') ||
    fileType === 'application/octet-stream';

  useEffect(() => {
    if (isText && filePath) {
      loadTextFile();
    }
  }, [filePath, isText]);

  const loadTextFile = async () => {
    if (!filePath) return;
    try {
      setIsLoading(true);
      const base64 = await (FileSystem as any).readAsStringAsync(filePath, {
        encoding: 'base64',
      });
      const decoded = decodeBase64Utf8(base64);
      setTextFileContent(decoded);
      setError(null);
    } catch (e) {
      console.error('Erreur lecture fichier texte:', e);
      setError('Impossible de lire le fichier texte');
    } finally {
      setIsLoading(false);
    }
  };

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
          onLoadComplete={(numberOfPages) => {
            console.log(`PDF chargé : ${numberOfPages} pages`);
            setIsLoading(false);
          }}
          onError={(err) => {
            console.error('Erreur PDF:', err);
            setError('Impossible de charger le PDF');
            setIsLoading(false);
          }}
          onLoadProgress={(percent) => {
            if (percent === 1) setIsLoading(false);
          }}
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

  // ===== TEXTE / FICHIER TEXTE =====
  if (isText) {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loaderText}>Chargement du fichier...</Text>
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

    const displayContent = textFileContent || content || '(fichier vide)';
    return <ContentRenderer content={displayContent} />;
  }

  // ===== CONTENU TEXTE SIMPLE (sans fichier) =====
  if (!fileType && content) {
    return <ContentRenderer content={content} />;
  }

  // ===== FICHIER INCONNU =====
  return (
    <View style={styles.unknownContainer}>
      <Ionicons
        name={isPdf ? 'document-text' : 'document'}
        size={64}
        color={Colors.light.primary}
      />
      <Text style={styles.unknownTitle}>{title}</Text>
      <Text style={styles.unknownText}>
        {fileType ? `Type : ${fileType}` : 'Type inconnu'}
      </Text>
      <Text style={styles.unknownHint}>
        Ce type de fichier n'est pas encore lisible dans l'appli.
      </Text>
      {content ? (
        <View style={styles.unknownContentBox}>
          <Markdown style={markdownStyles}>{content}</Markdown>
        </View>
      ) : null}
    </View>
  );
}

// ============================================================
// 🆕 RENDERER DE CONTENU : détecte __VISUAL__ et SVG brut
// ============================================================
function ContentRenderer({ content }: { content: string }) {
  // 1. Priorité au marqueur __VISUAL__ (généré par Prof)
  const visual = parseVisualMarker(content);

  if (visual) {
    const cleanContent = stripVisualMarker(content);
    return (
      <ScrollView style={styles.textContainer} contentContainerStyle={styles.textContent}>
        {cleanContent ? (
          <Markdown style={markdownStyles}>{cleanContent}</Markdown>
        ) : null}
        <VisualBubble
          type={visual.type}
          title={visual.title}
          code={visual.code}
        />
      </ScrollView>
    );
  }

  // 2. Sinon, détecte un SVG brut (<svg>...</svg>)
  const rawSvg = detectRawSvg(content);

  if (rawSvg) {
    return (
      <ScrollView style={styles.textContainer} contentContainerStyle={styles.textContent}>
        {rawSvg.before ? (
          <Markdown style={markdownStyles}>{rawSvg.before}</Markdown>
        ) : null}
        <VisualBubble
          type="svg"
          title="Schéma"
          code={rawSvg.svg}
        />
        {rawSvg.after ? (
          <Markdown style={markdownStyles}>{rawSvg.after}</Markdown>
        ) : null}
      </ScrollView>
    );
  }

  // 3. Sinon, rendu Markdown normal
  return (
    <ScrollView style={styles.textContainer} contentContainerStyle={styles.textContent}>
      <Markdown style={markdownStyles}>{content}</Markdown>
    </ScrollView>
  );
}

// Décode le base64 en texte UTF-8
function decodeBase64Utf8(base64: string): string {
  try {
    const binaryString = (global as any).atob
      ? (global as any).atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');

    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    console.error('Erreur décodage base64:', e);
    return '';
  }
}

// 🆕 A6 : styles Markdown pour les documents
const markdownStyles = {
  body: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: Fonts.regular,
    color: Colors.light.text,
  },
  strong: {
    fontFamily: Fonts.bold,
    fontWeight: '700' as const,
  },
  em: {
    fontStyle: 'italic' as const,
    fontFamily: Fonts.regular,
  },
  heading1: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    fontWeight: '700' as const,
    color: Colors.light.primary,
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingBottom: 4,
  },
  heading2: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    fontWeight: '700' as const,
    color: Colors.light.primary,
    marginTop: 14,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginTop: 10,
    marginBottom: 4,
  },
  bullet_list: {
    marginVertical: 6,
  },
  ordered_list: {
    marginVertical: 6,
  },
  list_item: {
    marginVertical: 3,
  },
  code_inline: {
    backgroundColor: '#F0F0F0',
    color: '#C7254E',
    paddingHorizontal: 5,
    borderRadius: 3,
    fontFamily: 'monospace',
    fontSize: 14,
  },
  fence: {
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 6,
    fontFamily: 'monospace',
    fontSize: 13,
    marginVertical: 8,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.primary,
    paddingLeft: 12,
    paddingVertical: 4,
    fontStyle: 'italic' as const,
    color: Colors.light.textSecondary,
    marginVertical: 6,
    backgroundColor: Colors.light.backgroundElement,
  },
  link: {
    color: Colors.light.primary,
    textDecorationLine: 'underline' as const,
  },
  hr: {
    backgroundColor: Colors.light.border,
    height: 1,
    marginVertical: 12,
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fullImage: {
    flex: 1,
    width: '100%',
  },
  pdf: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.light.backgroundElement,
  },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    gap: Spacing.two,
  },
  loaderText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.light.textSecondary,
  },
  errorText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.light.error,
    textAlign: 'center',
    padding: Spacing.four,
  },
  textContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  textContent: {
    padding: Spacing.four,
  },
  textContentText: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: Fonts.regular,
    color: Colors.light.text,
  },
  unknownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.five,
    gap: Spacing.three,
  },
  unknownTitle: {
    fontSize: 20,
    fontFamily: Fonts.semibold,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center',
  },
  unknownText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.light.textSecondary,
  },
  unknownHint: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.light.textSecondary,
    fontStyle: 'italic' as const,
    textAlign: 'center',
  },
  unknownContentBox: {
    marginTop: Spacing.four,
    padding: Spacing.three,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: Spacing.two,
    width: '100%',
  },
  unknownContentText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.light.text,
    lineHeight: 20,
  },
});