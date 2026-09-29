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

import {
  getAllScheduledNotifications,
  isNotificationsAvailable,
  requestNotificationPermission,
  scheduleNotification,
} from '@/config/notifications';
import { Colors, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SettingsModal({ visible, onClose }: Props) {
  const [notifCount, setNotifCount] = useState<number | null>(null);

  const testPermission = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      Alert.alert('Permission accordée', 'Les notifications sont autorisées.');
    } else {
      Alert.alert(
        'Permission refusée',
        'Les notifications ne sont pas disponibles dans Expo Go. Il faudra un Development Build.',
      );
    }
  };

  const requestExactAlarm = async () => {
    if (!isNotificationsAvailable()) {
      Alert.alert('Development Build requis', 'Disponible uniquement en Development Build.');
      return;
    }

    try {
      const { requestExactAlarmPermission } = require('expo-exact-alarms-permission');
      requestExactAlarmPermission();
      Alert.alert(
        'Paramètres ouverts',
        'Active "Alarmes et rappels" pour MonApp, puis reviens dans l\'appli.',
      );
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir les paramètres.');
    }
  };

  const testNotificationIn5Seconds = async () => {
    if (!isNotificationsAvailable()) {
      Alert.alert(
        'Development Build requis',
        "Les notifications ne fonctionnent pas dans Expo Go. Il faudra créer un Development Build pour les tester.",
      );
      return;
    }

    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert('Permission requise', "Il faut d'abord autoriser les notifications.");
      return;
    }

    const date = new Date(Date.now() + 5000);
    try {
      await scheduleNotification({
        title: 'Test de notification',
        body: 'Si tu vois ce message, tout fonctionne !',
        date,
      });
      Alert.alert('Notification programmée', 'Tu vas recevoir une notification dans 5 secondes.');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de programmer la notification.');
    }
  };

  const checkScheduled = async () => {
    if (!isNotificationsAvailable()) {
      Alert.alert('Development Build requis', 'Disponible uniquement en Development Build.');
      return;
    }

    const all = await getAllScheduledNotifications();
    setNotifCount(all.length);
    Alert.alert(
      'Notifications programmées',
      `Il y a ${all.length} notification(s) en attente.`,
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>Paramètres</Text>

          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Connexion</Text>
              <Text style={styles.rowLabel}>Statut serveur</Text>
              <Text style={styles.rowValue}>Connecté à Railway</Text>
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
              <Text style={styles.sectionTitle}>Données</Text>
              <Text style={styles.rowLabel}>Mémoire locale</Text>
              <Text style={styles.rowValue}>SQLite activé</Text>
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