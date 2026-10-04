import { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  importBackup,
  pickBackupFile,
  shareBackup,
  wipeAllData
} from '@/config/backup';
import {
  getAllScheduledNotifications,
  isNotificationsAvailable,
  requestNotificationPermission,
  scheduleNotification,
} from '@/config/notifications';
import { getLocalProfile } from '@/config/user';
import { Colors, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SettingsModal({ visible, onClose }: Props) {
  const [notifCount, setNotifCount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const profile = getLocalProfile();
  // 🆕 Bug #8 : safe area pour ne pas cacher le bouton Fermer
  const insets = useSafeAreaInsets();

  const testPermission = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      Alert.alert('Permission accordée', 'Les notifications sont autorisées.');
    } else {
      Alert.alert('Permission refusée', 'Les notifications ne sont pas disponibles.');
    }
  };

  const requestExactAlarm = async () => {
    if (!isNotificationsAvailable()) {
      Alert.alert('Development Build requis', 'Disponible en Development Build uniquement.');
      return;
    }

    try {
      const { requestExactAlarmPermission } = require('expo-exact-alarms-permission');
      requestExactAlarmPermission();
      Alert.alert('Paramètres ouverts', 'Active "Alarmes et rappels" pour l\'appli.');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir les paramètres.');
    }
  };

  const testNotificationIn5Seconds = async () => {
    if (!isNotificationsAvailable()) {
      Alert.alert('Development Build requis', 'Non disponible.');
      return;
    }

    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert('Permission requise', 'Autorise les notifications d\'abord.');
      return;
    }

    const date = new Date(Date.now() + 5000);
    try {
      await scheduleNotification({
        title: 'Test de notification',
        body: 'Si tu vois ce message, tout fonctionne !',
        date,
      });
      Alert.alert('Notification programmée', 'Dans 5 secondes.');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de programmer.');
    }
  };

  const checkScheduled = async () => {
    if (!isNotificationsAvailable()) {
      Alert.alert('Development Build requis', 'Non disponible.');
      return;
    }

    const all = await getAllScheduledNotifications();
    setNotifCount(all.length);
    Alert.alert('Notifications programmées', `${all.length} en attente.`);
  };

  const handleExport = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const result = await shareBackup();
      if (!result.success) {
        Alert.alert('Erreur', result.error || 'Impossible d\'exporter.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    if (isProcessing) return;

    Alert.alert(
      'Importer une sauvegarde ?',
      'Toutes les données actuelles seront remplacées par celles du fichier ZIP.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const pickResult = await pickBackupFile();
              if (!pickResult.success || !pickResult.filePath) {
                if (pickResult.error !== 'Annulé') {
                  Alert.alert('Erreur', pickResult.error || 'Aucun fichier sélectionné.');
                }
                return;
              }

              const result = await importBackup(pickResult.filePath);
              if (result.success && result.stats) {
                Alert.alert(
                  'Restauration réussie !',
                  `${result.stats.messages} messages\n${result.stats.reminders} rappels\n${result.stats.documents} documents\n${result.stats.hasProfile ? 'Profil restauré' : 'Aucun profil'}`,
                );
              } else {
                Alert.alert('Erreur', result.error || 'Impossible d\'importer.');
              }
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ],
    );
  };

  const handleWipe = () => {
    Alert.alert(
      '⚠️ Tout effacer ?',
      'Cette action est irréversible. Toutes tes conversations, documents, rappels et amis seront supprimés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'TOUT EFFACER',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmation finale',
              'Es-tu vraiment sûr ? Cette action ne peut PAS être annulée.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Oui, tout effacer',
                  style: 'destructive',
                  onPress: () => {
                    wipeAllData();
                    Alert.alert('Effacé', 'Toutes les données ont été supprimées.');
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { paddingBottom: insets.bottom + Spacing.four }]}>
          <Text style={styles.title}>Paramètres</Text>

          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mon profil</Text>
              {profile ? (
                <>
                  <Text style={styles.rowLabel}>Prénom</Text>
                  <Text style={styles.rowValue}>{profile.firstName}</Text>
                  <Text style={styles.rowLabel}>Code</Text>
                  <Text style={styles.rowValue}>{profile.code}</Text>
                </>
              ) : (
                <Text style={styles.rowValue}>Non configuré</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sauvegarde</Text>

              <TouchableOpacity
                style={styles.button}
                onPress={handleExport}
                disabled={isProcessing}
              >
                <Text style={styles.buttonText}>
                  {isProcessing ? 'En cours...' : '📤 Exporter mes données (ZIP)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={handleImport}
                disabled={isProcessing}
              >
                <Text style={styles.buttonText}>
                  📥 Importer une sauvegarde (ZIP)
                </Text>
              </TouchableOpacity>

              <Text style={styles.hint}>
                L'export crée un fichier ZIP contenant toutes tes conversations,
                documents et rappels. Conserve-le précieusement (Drive, email…).
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notifications</Text>

              <TouchableOpacity style={styles.button} onPress={testPermission}>
                <Text style={styles.buttonText}>Demander la permission</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={requestExactAlarm}>
                <Text style={styles.buttonText}>Autoriser les alarmes exactes</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={testNotificationIn5Seconds}>
                <Text style={styles.buttonText}>Tester (dans 5 secondes)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={checkScheduled}>
                <Text style={styles.buttonText}>Voir les notifications en attente</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Zone dangereuse</Text>

              <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                onPress={handleWipe}
              >
                <Text style={styles.dangerText}>🗑️ Effacer toutes mes données</Text>
              </TouchableOpacity>
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
    maxHeight: '85%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: Spacing.three,
  },
  content: { flexGrow: 0 },
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
    marginBottom: Spacing.three,
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
  hint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.two,
    lineHeight: 18,
  },
  button: {
    backgroundColor: Colors.light.backgroundElement,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
  },
  buttonText: {
    fontSize: 15,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#FFEBEE',
  },
  dangerText: {
    fontSize: 15,
    color: Colors.light.error,
    fontWeight: '600',
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