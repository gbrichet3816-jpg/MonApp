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
import Pdf from 'react-native-pdf';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  filePath: string | null;
  fileType: string | null;
  title: string;
  content: string;
};

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

  // Charge le contenu du fichier texte
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

    return (
      <ScrollView style={styles.textContainer} contentContainerStyle={styles.textContent}>
        <Text style={styles.textContentText} selectable>
          {displayContent}
        </Text>
      </ScrollView>
    );
  }

  // ===== CONTENU TEXTE SIMPLE (sans fichier) =====
  if (!fileType && content) {
    return (
      <ScrollView style={styles.textContainer} contentContainerStyle={styles.textContent}>
        <Text style={styles.textContentText} selectable>
          {content}
        </Text>
      </ScrollView>
    );
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
          <Text style={styles.unknownContentText}>{content}</Text>
        </View>
      ) : null}
    </View>
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
    color: Colors.light.textSecondary,
  },
  errorText: {
    fontSize: 14,
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
    color: Colors.light.text,
    fontFamily: 'monospace',
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
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  unknownText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  unknownHint: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
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
    color: Colors.light.text,
    lineHeight: 20,
  },
});