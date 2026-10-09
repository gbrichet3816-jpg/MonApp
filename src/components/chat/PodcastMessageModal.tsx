// src/components/chat/PodcastMessageModal.tsx
// 🎙️ Modal de génération podcast — affiche la progression, se ferme automatiquement

import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  progress?: number; // 0 à 1
  onCancel?: () => void; // optionnel : permet d'annuler manuellement
};

export default function PodcastMessageModal({
  visible,
  title,
  progress = 0,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.panel}>
          {/* Titre */}
          <Text style={styles.header}>🎙️ Génération du podcast…</Text>

          {/* Titre du podcast en cours */}
          <Text style={styles.podcastTitle} numberOfLines={3}>
            {title}
          </Text>

          {/* Spinner */}
          <ActivityIndicator
            size="large"
            color={Colors.light.primary}
            style={styles.spinner}
          />

          {/* Barre de progression */}
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>

          {/* Hint */}
          <Text style={styles.hint}>
            Cela peut prendre quelques secondes
          </Text>

          {/* Bouton annuler (optionnel) */}
          {onCancel && (
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Ionicons name="close-circle-outline" size={18} color={Colors.light.textSecondary} />
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  panel: {
    backgroundColor: Colors.light.background,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: Spacing.three,
  },
  header: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
  },
  podcastTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.primary,
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
  },
  spinner: {
    marginVertical: Spacing.two,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: Colors.light.primary,
  },
  hint: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  cancelText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
});