import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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

  const isImage = fileType?.startsWith('image/');
  const isPdf = fileType?.includes('pdf');
  const isText = fileType?.startsWith('text/');

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
          onPageChanged={(page, numberOfPages) => {
            console.log(`Page ${page}/${numberOfPages}`);
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

  // ===== TEXTE ou contenu simple =====
  if ((isText || !fileType) && content) {
    return (
      <ScrollView style={styles.textContainer} contentContainerStyle={styles.textContent}>
        <Text style={styles.textContentText}>{content}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
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
    fontSize: 16,
    lineHeight: 24,
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