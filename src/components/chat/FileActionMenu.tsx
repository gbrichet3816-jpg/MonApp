import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export type FileAction = 'analyze' | 'share' | 'store';

type Props = {
  visible: boolean;
  fileName: string;
  onClose: () => void;
  onAction: (action: FileAction) => void;
};

export default function FileActionMenu({ visible, fileName, onClose, onAction }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>Que veux-tu faire ?</Text>
          <Text style={styles.fileName} numberOfLines={1}>
            {fileName}
          </Text>

          <TouchableOpacity style={styles.option} onPress={() => onAction('analyze')}>
            <Ionicons name="sparkles" size={26} color={Colors.light.primary} />
            <View style={styles.optionTextBlock}>
              <Text style={styles.optionText}>Analyser avec l'agent</Text>
              <Text style={styles.optionHint}>Envoie à l'agent dans le chat</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={() => onAction('share')}>
            <Ionicons name="people" size={26} color={Colors.light.primary} />
            <View style={styles.optionTextBlock}>
              <Text style={styles.optionText}>Partager avec un ami</Text>
              <Text style={styles.optionHint}>Envoie à un ami de l'appli</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={() => onAction('store')}>
            <Ionicons name="bookmark" size={26} color={Colors.light.primary} />
            <View style={styles.optionTextBlock}>
              <Text style={styles.optionText}>Garder dans ma bibliothèque</Text>
              <Text style={styles.optionHint}>Sauvegarde sur ton téléphone</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
  },
  fileName: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.half,
    marginBottom: Spacing.three,
    fontStyle: 'italic',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundElement,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    gap: Spacing.three,
  },
  optionTextBlock: { flex: 1 },
  optionText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '600',
  },
  optionHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
});