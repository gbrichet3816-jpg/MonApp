import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SettingsModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>Paramètres</Text>

          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Connexion</Text>
              <Text style={styles.rowLabel}>Statut serveur</Text>
              <Text style={styles.rowValue}>Non configuré</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Agents</Text>
              <Text style={styles.rowLabel}>Agents installés</Text>
              <Text style={styles.rowValue}>0</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Permissions</Text>
              <Text style={styles.rowLabel}>Micro</Text>
              <Text style={styles.rowValue}>Non demandé</Text>
              <Text style={styles.rowLabel}>Localisation</Text>
              <Text style={styles.rowValue}>Non demandé</Text>
              <Text style={styles.rowLabel}>Caméra</Text>
              <Text style={styles.rowValue}>Non demandé</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Données</Text>
              <Text style={styles.rowLabel}>Mémoire locale</Text>
              <Text style={styles.rowValue}>0 conversation</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>À propos</Text>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Fermer</Text>
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
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: Spacing.three,
  },
  content: {
    flexGrow: 0,
  },
  section: {
    marginBottom: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.primary,
    textTransform: 'uppercase',
    marginBottom: Spacing.two,
  },
  rowLabel: {
    fontSize: 15,
    color: Colors.light.text,
    marginTop: Spacing.two,
  },
  rowValue: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: Spacing.half,
  },
  closeButton: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '600',
  },
});