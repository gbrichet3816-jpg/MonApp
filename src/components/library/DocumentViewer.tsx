import { Ionicons } from '@expo/vector-icons';
import { Audio, ResizeMode, Video } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  const isAudio = fileType?.startsWith('audio/');
  const isVideo = fileType?.startsWith('video/');
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

  // ===== AUDIO =====
  if (isAudio && filePath) {
    return <AudioPlayer uri={filePath} />;
  }

  // ===== VIDÉO =====
  if (isVideo && filePath) {
    return (
      <View style={styles.videoContainer}>
        <Video
          source={{ uri: filePath }}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
        />
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
      {content ? (
        <View style={styles.unknownContentBox}>
          <Text style={styles.unknownContentText}>{content}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ===== LECTEUR AUDIO =====
function AudioPlayer({ uri }: { uri: string }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    loadAudio();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [uri]);

  const loadAudio = async () => {
    try {
      setIsLoading(true);
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        (status) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis);
            setDuration(status.durationMillis || 0);
            setIsPlaying(status.isPlaying);
          }
        },
      );
      soundRef.current = sound;
      setIsLoading(false);
    } catch (e) {
      console.error('Erreur chargement audio:', e);
      setIsLoading(false);
    }
  };

  const togglePlay = async () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View style={styles.audioContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.audioContainer}>
      <Ionicons name="musical-notes" size={64} color={Colors.light.primary} />

      <TouchableOpacity style={styles.audioPlayButton} onPress={togglePlay}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={40}
          color={Colors.light.background}
        />
      </TouchableOpacity>

      <Text style={styles.audioTime}>
        {formatTime(position)} / {formatTime(duration)}
      </Text>
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
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: 300,
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
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
    padding: Spacing.five,
  },
  audioPlayButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioTime: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
});