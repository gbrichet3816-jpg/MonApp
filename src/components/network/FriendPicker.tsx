import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchFriendsFromServer,
  getLocalProfile,
  loadFriendNicknames,
} from '@/config/user';
import { Colors, Fonts, Spacing } from '@/constants/theme';

type Friend = {
  code: string;
  firstName: string;
  addedAt: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedCodes: string[]) => void;
  confirmLabel?: string;
};

export default function FriendPicker({
  visible,
  onClose,
  onConfirm,
  confirmLabel = 'Envoyer',
}: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 🆕 Bug #26 : SafeArea pour ne pas cacher le bouton Envoyer
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 80);

  useEffect(() => {
    if (visible) {
      loadFriends();
      setNicknames(loadFriendNicknames());
      setSelected([]);
    }
  }, [visible]);

  const loadFriends = async () => {
    const profile = getLocalProfile();
    if (!profile) return;

    setIsLoading(true);
    const result = await fetchFriendsFromServer(profile.code);
    if (result.success && result.friends) {
      setFriends(result.friends);
    }
    setIsLoading(false);
  };

  const toggleFriend = (code: string) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const getDisplayName = (friend: Friend) => {
    return nicknames[friend.code] || friend.firstName;
  };

  const handleConfirm = () => {
    if (selected.length === 0) return;
    onConfirm(selected);
    setSelected([]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { paddingBottom: safeBottom }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Choisir les amis</Text>
            <View style={{ width: 26 }} />
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={Colors.light.textSecondary} />
              <Text style={styles.emptyTitle}>Aucun ami</Text>
              <Text style={styles.emptyText}>
                Ajoute des amis dans "Mon réseau" pour pouvoir partager.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {friends.map((friend) => {
                const isSelected = selected.includes(friend.code);
                return (
                  <TouchableOpacity
                    key={friend.code}
                    style={[styles.friendItem, isSelected && styles.friendItemSelected]}
                    onPress={() => toggleFriend(friend.code)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={isSelected ? Colors.light.primary : Colors.light.textSecondary}
                    />
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{getDisplayName(friend)}</Text>
                      <Text style={styles.friendCode}>{friend.code}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.confirmButton, selected.length === 0 && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={selected.length === 0}
          >
            <Text style={styles.confirmText}>
              {confirmLabel}
              {selected.length > 0 ? ` (${selected.length})` : ''}
            </Text>
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
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    color: Colors.light.text,
  },
  loadingContainer: {
    padding: Spacing.five,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: Spacing.five,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    color: Colors.light.text,
    marginTop: Spacing.three,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  list: {
    maxHeight: 400,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
    marginBottom: Spacing.two,
    gap: Spacing.three,
  },
  friendItemSelected: {
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    color: Colors.light.text,
  },
  friendCode: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  confirmButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    color: Colors.light.background,
  },
});