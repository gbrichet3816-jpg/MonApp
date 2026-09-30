import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    addFriendOnServer,
    deleteFriendNickname,
    fetchFriendsFromServer,
    getLocalProfile,
    loadFriendNicknames,
    removeFriendOnServer,
    saveFriendNickname,
} from '@/config/user';
import { Colors, Spacing } from '@/constants/theme';

type Friend = {
  code: string;
  firstName: string;
  addedAt: number;
};

export default function NetworkScreen() {
  const [profile, setProfile] = useState<{ code: string; firstName: string } | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [newFriendCode, setNewFriendCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [renamingCode, setRenamingCode] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    const local = getLocalProfile();
    if (local) {
      setProfile({ code: local.code, firstName: local.firstName });
      loadFriends(local.code);
    }
    setNicknames(loadFriendNicknames());
  }, []);

  const loadFriends = async (code: string) => {
    setIsLoading(true);
    const result = await fetchFriendsFromServer(code);
    if (result.success && result.friends) {
      setFriends(result.friends);
    }
    setIsLoading(false);
  };

  const handleCopyCode = async () => {
    if (!profile) return;
    await Clipboard.setStringAsync(profile.code);
    Alert.alert('Copié !', 'Ton code est dans le presse-papiers.');
  };

  const handleAddFriend = async () => {
    if (!profile) return;
    const trimmed = newFriendCode.trim().toUpperCase();

    if (!trimmed) {
      Alert.alert('Code requis', "Entre le code de ton ami.");
      return;
    }

    setIsLoading(true);
    const result = await addFriendOnServer({
      myCode: profile.code,
      friendCode: trimmed,
    });

    if (result.success) {
      Alert.alert('Ami ajouté !', `${result.friend?.firstName || trimmed} est maintenant dans ta liste.`);
      setNewFriendCode('');
      loadFriends(profile.code);
    } else {
      Alert.alert('Erreur', result.error || "Impossible d'ajouter cet ami.");
    }
    setIsLoading(false);
  };

  const handleRemoveFriend = (friend: Friend) => {
    if (!profile) return;
    Alert.alert(
      'Retirer cet ami ?',
      `${getDisplayName(friend)} sera retiré de ta liste.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            const result = await removeFriendOnServer({
              myCode: profile.code,
              friendCode: friend.code,
            });
            if (result.success) {
              deleteFriendNickname(friend.code);
              loadFriends(profile.code);
              setNicknames(loadFriendNicknames());
            } else {
              Alert.alert('Erreur', result.error);
            }
          },
        },
      ],
    );
  };

  const handleStartRename = (friend: Friend) => {
    setRenamingCode(friend.code);
    setRenameValue(nicknames[friend.code] || friend.firstName);
  };

  const handleSaveRename = () => {
    if (!renamingCode) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      Alert.alert('Nom requis', 'Entre un nom.');
      return;
    }
    saveFriendNickname(renamingCode, trimmed);
    setNicknames(loadFriendNicknames());
    setRenamingCode(null);
    setRenameValue('');
  };

  const getDisplayName = (friend: Friend) => {
    return nicknames[friend.code] || friend.firstName;
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.light.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mon réseau</Text>
          <View style={styles.iconButton} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Profil non configuré.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon réseau</Text>
        <View style={styles.iconButton} />
      </View>

      <FlatList
        data={friends}
        keyExtractor={(item) => item.code}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mon code personnel</Text>
              <TouchableOpacity style={styles.codeBox} onPress={handleCopyCode}>
                <Text style={styles.codeText}>{profile.code}</Text>
                <Ionicons name="copy-outline" size={20} color={Colors.light.primary} />
              </TouchableOpacity>
              <Text style={styles.codeHint}>
                Partage ce code avec tes amis pour qu'ils puissent t'ajouter.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ajouter un ami</Text>
              <View style={styles.addRow}>
                <TextInput
                  style={styles.input}
                  value={newFriendCode}
                  onChangeText={setNewFriendCode}
                  placeholder="Code de ton ami (ex: JULES-123456)"
                  placeholderTextColor={Colors.light.textSecondary}
                  autoCapitalize="characters"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={[styles.addButton, isLoading && styles.buttonDisabled]}
                  onPress={handleAddFriend}
                  disabled={isLoading}
                >
                  <Ionicons name="add" size={24} color={Colors.light.background} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionTitle}>
              Mes amis ({friends.length})
            </Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={Colors.light.textSecondary} />
            <Text style={styles.emptyTitle}>Aucun ami</Text>
            <Text style={styles.emptyText}>
              Ajoute ton premier ami avec son code.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.friendItem}>
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{getDisplayName(item)}</Text>
              <Text style={styles.friendCode}>{item.code}</Text>
            </View>

            <TouchableOpacity
              style={styles.friendAction}
              onPress={() => handleStartRename(item)}
            >
              <Ionicons name="pencil" size={18} color={Colors.light.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.friendAction}
              onPress={() => handleRemoveFriend(item)}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.light.error} />
            </TouchableOpacity>
          </View>
        )}
      />

      {renamingCode && (
        <View style={styles.renameOverlay}>
          <View style={styles.renamePanel}>
            <Text style={styles.renameTitle}>Renommer cet ami</Text>
            <TextInput
              style={styles.input}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Nouveau nom"
              placeholderTextColor={Colors.light.textSecondary}
              autoFocus
            />
            <View style={styles.renameActions}>
              <TouchableOpacity
                style={styles.renameCancel}
                onPress={() => {
                  setRenamingCode(null);
                  setRenameValue('');
                }}
              >
                <Text style={styles.renameCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.renameSave} onPress={handleSaveRename}>
                <Text style={styles.renameSaveText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  iconButton: {
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  listContent: {
    padding: Spacing.three,
  },
  section: {
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.primary,
    textTransform: 'uppercase',
    marginBottom: Spacing.two,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.backgroundElement,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  codeText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.primary,
    letterSpacing: 1,
  },
  codeHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: Spacing.two,
    fontStyle: 'italic',
  },
  addRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.light.backgroundElement,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 15,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  addButton: {
    width: 50,
    backgroundColor: Colors.light.primary,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundElement,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  friendCode: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  friendAction: {
    padding: Spacing.two,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: Spacing.five,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: Spacing.two,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  renameOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  renamePanel: {
    width: '100%',
    backgroundColor: Colors.light.background,
    padding: Spacing.four,
    borderRadius: Spacing.three,
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.three,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  renameCancel: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  renameCancelText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  renameSave: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    backgroundColor: Colors.light.primary,
    borderRadius: Spacing.two,
  },
  renameSaveText: {
    fontSize: 15,
    color: Colors.light.background,
    fontWeight: '600',
  },
});