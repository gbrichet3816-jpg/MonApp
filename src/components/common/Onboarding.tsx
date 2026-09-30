import { useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import {
    generateCode,
    registerOnServer,
    saveLocalProfile,
} from '@/config/user';
import { Colors, Spacing } from '@/constants/theme';

type Props = {
  onComplete: () => void;
};

export default function Onboarding({ onComplete }: Props) {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    const trimmed = firstName.trim();
    if (trimmed.length < 2) {
      Alert.alert('Prénom requis', 'Entre ton prénom (2 lettres minimum).');
      return;
    }

    setIsLoading(true);

    try {
      const code = generateCode(trimmed);

      const result = await registerOnServer({
        code,
        firstName: trimmed,
        email: email.trim() || undefined,
      });

      if (!result.success) {
        Alert.alert(
          'Erreur',
          result.error || "Impossible de s'enregistrer. Vérifie ta connexion.",
        );
        setIsLoading(false);
        return;
      }

      saveLocalProfile({
        code,
        firstName: trimmed,
        registered: true,
      });

      Alert.alert(
        'Bienvenue !',
        `Ton code personnel est :\n\n${code}\n\nNote-le, il te servira à ajouter des amis.`,
        [{ text: 'OK', onPress: onComplete }],
      );
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue.');
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Bienvenue !</Text>
        <Text style={styles.subtitle}>
          Avant de commencer, dis-moi qui tu es.
        </Text>

        <Text style={styles.label}>Ton prénom</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="Ex : Léa"
          placeholderTextColor={Colors.light.textSecondary}
          autoCapitalize="words"
          editable={!isLoading}
        />

        <Text style={styles.label}>Email du parent (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Pour récupérer ton compte plus tard"
          placeholderTextColor={Colors.light.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
        />

        <Text style={styles.info}>
          Un code personnel te sera attribué pour ajouter des amis.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Enregistrement...' : 'Continuer'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: Spacing.four,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.light.primary,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.five,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.two,
    marginTop: Spacing.three,
  },
  input: {
    backgroundColor: Colors.light.backgroundElement,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  info: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.four,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: Colors.light.primary,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.background,
  },
});