import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DocumentViewer from '@/components/library/DocumentViewer';
import FriendPicker from '@/components/network/FriendPicker';
import {
  saveMultipleAudios,
  shareAudioFile,
  shareMultipleAudios
} from '@/config/audio';
import {
  deleteDocument,
  Document,
  loadDocuments,
  saveDocument,
} from '@/config/database';
import { deleteFileFromDocuments } from '@/config/files';
import {
  printPdf,
  saveMultiplePdfs,
  shareMultiplePdfs,
  sharePdf,
} from '@/config/pdf';
import {
  acceptDocument,
  fetchPendingDocs,
  getLocalProfile,
  refuseDocument,
  shareDocumentWithFriends,
} from '@/config/user';
import { Colors, Spacing } from '@/constants/theme';

type PendingDoc = {
  id: string;
  fromCode: string;
  fromName: string;
  title: string;
  content: string;
  fileType: string | null;
  sharedAt: number;
};

export default function LibraryScreen() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [friendPickerVisible, setFriendPickerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'written' | 'audio'>('written');

  useEffect(() => {
    loadAll();
    loadPending();
  }, []);

  const loadAll = () => {
    const docs = loadDocuments();
    setDocuments(docs);
  };

  const loadPending = async () => {
    const profile = getLocalProfile();
    if (!profile) return;

    setIsLoadingPending(true);
    const result = await fetchPendingDocs(profile.code);
    if (result.success && result.documents) {
      setPendingDocs(result.documents);
    }
    setIsLoadingPending(false);
  };

  const handleAccept = async (doc: PendingDoc) => {
    const profile = getLocalProfile();
    if (!profile) return;

    const localId = `shared-${doc.id}`;
    saveDocument({
      id: localId,
      agentId: doc.fromName || 'ami',
      title: doc.title,
      content: doc.content,
      fileType: doc.fileType || undefined,
    });

    const result = await acceptDocument({
      docId: doc.id,
      userCode: profile.code,
    });

    if (result.success) {
      setPendingDocs((prev) => prev.filter((d) => d.id !== doc.id));
      loadAll();
      Alert.alert('Ajouté !', `"${doc.title}" est dans ta bibliothèque.`);
    } else {
      Alert.alert('Erreur', result.error || 'Impossible d\'accepter.');
    }
  };

  const handleRefuse = async (doc: PendingDoc) => {
    const profile = getLocalProfile();
    if (!profile) return;

    Alert.alert(
      'Refuser ce document ?',
      `"${doc.title}" sera supprimé définitivement.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            const result = await refuseDocument({
              docId: doc.id,
              userCode: profile.code,
            });

            if (result.success) {
              setPendingDocs((prev) => prev.filter((d) => d.id !== doc.id));
            } else {
              Alert.alert('Erreur', result.error);
            }
          },
        },
      ],
    );
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const enterSelectionMode = (id?: string) => {
    setSelectionMode(true);
    if (id) setSelectedIds([id]);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const handleLongPress = (doc: Document) => {
    if (!selectionMode) {
      enterSelectionMode(doc.id);
    }
  };

  const handlePress = (doc: Document) => {
    if (selectionMode) {
      toggleSelection(doc.id);
    } else {
      setSelectedDoc(doc);
    }
  };

  const getSelectedDocuments = () => {
    return documents.filter((d) => selectedIds.includes(d.id));
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;

    Alert.alert(
      `Supprimer ${selectedIds.length} document(s) ?`,
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) {
              const filePath = deleteDocument(id);
              if (filePath) {
                await deleteFileFromDocuments(filePath);
              }
            }
            exitSelectionMode();
            loadAll();
          },
        },
      ],
    );
  };

  // 🆕 Étape 4 : gère à la fois les écrits (PDF) et les audios (.m4a)
  const handleSaveSelected = async () => {
    if (selectedIds.length === 0) return;

    const selected = getSelectedDocuments();
    const audios = selected.filter(
      (d) => d.fileType?.startsWith('audio/') && d.filePath,
    );
    const others = selected.filter((d) => !d.fileType?.startsWith('audio/'));

    let totalSuccess = 0;
    let totalFailed = 0;

    if (others.length > 0) {
      const docs = others.map((d) => ({
        title: d.title,
        content: d.content,
        agentId: d.agentId,
      }));
      const result = await saveMultiplePdfs(docs);
      totalSuccess += result.success;
      totalFailed += result.failed;
    }

    if (audios.length > 0) {
      const result = await saveMultipleAudios(
        audios.map((d) => ({ filePath: d.filePath!, title: d.title })),
      );
      totalSuccess += result.success;
      totalFailed += result.failed;
    }

    if (totalFailed === 0) {
      Alert.alert('Enregistré !', `${totalSuccess} document(s) enregistré(s).`);
    } else {
      Alert.alert(
        'Partiellement enregistré',
        `${totalSuccess} réussi(s), ${totalFailed} échoué(s).`,
      );
    }
  };

  // 🆕 Étape 4 : sépare écrits / audios pour le partage système
  const handleShareExternal = async () => {
    if (selectedIds.length === 0) return;

    const selected = getSelectedDocuments();
    const audios = selected.filter(
      (d) => d.fileType?.startsWith('audio/') && d.filePath,
    );
    const others = selected.filter((d) => !d.fileType?.startsWith('audio/'));

    if (audios.length > 0) {
      await shareMultipleAudios(
        audios.map((d) => ({ filePath: d.filePath!, title: d.title })),
      );
    }

    if (others.length > 0) {
      const docs = others.map((d) => ({
        title: d.title,
        content: d.content,
        agentId: d.agentId,
      }));

      if (docs.length > 1) {
        Alert.alert(
          'Partage multiple',
          `${docs.length} documents vont être partagés un par un. Continue ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Continuer', onPress: () => shareMultiplePdfs(docs) },
          ],
        );
      } else {
        await shareMultiplePdfs(docs);
      }
    }
  };

  const handleShareToFriends = () => {
    if (selectedIds.length === 0) return;
    setFriendPickerVisible(true);
  };

  const handleFriendsSelected = async (friendCodes: string[]) => {
    setFriendPickerVisible(false);

    const profile = getLocalProfile();
    if (!profile) {
      Alert.alert('Erreur', 'Profil introuvable.');
      return;
    }

    const docs = getSelectedDocuments();
    let successCount = 0;
    let failCount = 0;

    for (const doc of docs) {
      let fileData: string | undefined;
      if (doc.filePath) {
        try {
          const base64 = await FileSystem.readAsStringAsync(doc.filePath, {
            encoding: 'base64',
          });
          fileData = base64;
        } catch (e) {
          console.warn('[Library] Impossible de lire le fichier:', e);
        }
      }

      const result = await shareDocumentWithFriends({
        fromCode: profile.code,
        toCodes: friendCodes,
        title: doc.title,
        content: doc.content,
        fileData,
        fileType: doc.fileType || undefined,
      });
      if (result.success) successCount++;
      else failCount++;
    }

    if (failCount === 0) {
      Alert.alert(
        'Partagé !',
        `${successCount} document(s) envoyé(s) à ${friendCodes.length} ami(s).`,
      );
      exitSelectionMode();
    } else {
      Alert.alert('Partiellement partagé', `${successCount} réussi(s), ${failCount} échoué(s).`);
    }
  };

  const handleDelete = (doc: Document) => {
    Alert.alert(
      'Supprimer ce document ?',
      `"${doc.title}" sera définitivement supprimé.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const filePath = deleteDocument(doc.id);
            if (filePath) {
              await deleteFileFromDocuments(filePath);
            }
            setSelectedDoc(null);
            loadAll();
          },
        },
      ],
    );
  };

  // 🆕 Étape 4 : bloque l'impression audio
  const handlePrint = async (doc: Document) => {
    if (doc.fileType?.startsWith('audio/')) {
      Alert.alert('Pas d\'impression', 'Un fichier audio ne peut pas être imprimé.');
      return;
    }
    const success = await printPdf({
      title: doc.title,
      content: doc.content,
      agentId: doc.agentId,
    });
    if (!success) Alert.alert('Erreur', "Impossible d'imprimer.");
  };

  // 🆕 Étape 4 : partage audio → menu système
  const handleShare = async (doc: Document) => {
    if (doc.fileType?.startsWith('audio/') && doc.filePath) {
      const success = await shareAudioFile(doc.filePath, doc.title);
      if (!success) Alert.alert('Erreur', 'Impossible de partager l\'audio.');
      return;
    }

    const success = await sharePdf({
      title: doc.title,
      content: doc.content,
      agentId: doc.agentId,
    });
    if (!success) Alert.alert('Erreur', 'Impossible de partager.');
  };

  const handleShareSingleToFriends = () => {
    if (!selectedDoc) return;
    setSelectedIds([selectedDoc.id]);
    setFriendPickerVisible(true);
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  // 🆕 Filtrage Écrits / Audios
  const isAudioDoc = (doc: Document) => doc.fileType?.startsWith('audio/') === true;
  const writtenDocs = documents.filter((d) => !isAudioDoc(d));
  const audioDocs = documents.filter((d) => isAudioDoc(d));
  const currentDocs = activeTab === 'written' ? writtenDocs : audioDocs;

  // ===== MODE SÉLECTION =====
  if (selectionMode) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={exitSelectionMode}>
            <Ionicons name="close" size={24} color={Colors.light.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
          </Text>
          <View style={styles.iconButton} />
        </View>

        <FlatList
          data={currentDocs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.id);
            const isImage = item.fileType?.startsWith('image/') && item.filePath;
            const isAudio = item.fileType?.startsWith('audio/') === true;

            return (
              <TouchableOpacity
                style={[styles.docItem, isSelected && styles.docItemSelected]}
                onPress={() => toggleSelection(item.id)}
              >
                <View style={styles.checkbox}>
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={isSelected ? Colors.light.primary : Colors.light.textSecondary}
                  />
                </View>

                {isImage ? (
                  <Image
                    source={{ uri: item.filePath! }}
                    style={styles.docThumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons
                    name={isAudio ? 'mic-outline' : 'document-text-outline'}
                    size={24}
                    color={Colors.light.primary}
                  />
                )}

                <View style={styles.docItemText}>
                  <Text style={styles.docItemTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.docItemMeta}>
                    {formatDate(item.createdAt)} · {item.agentId}
                    {item.fileType ? ' · 📎' : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShareToFriends}
            disabled={selectedIds.length === 0}
          >
            <Ionicons name="people-outline" size={20} color={Colors.light.background} />
            <Text style={styles.actionButtonText}>Amis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleSaveSelected}
            disabled={selectedIds.length === 0}
          >
            <Ionicons name="download-outline" size={20} color={Colors.light.background} />
            <Text style={styles.actionButtonText}>Enreg.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShareExternal}
            disabled={selectedIds.length === 0}
          >
            <Ionicons name="share-outline" size={20} color={Colors.light.background} />
            <Text style={styles.actionButtonText}>Partager</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionDanger]}
            onPress={handleDeleteSelected}
            disabled={selectedIds.length === 0}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.light.background} />
            <Text style={styles.actionButtonText}>Suppr.</Text>
          </TouchableOpacity>
        </View>

        <FriendPicker
          visible={friendPickerVisible}
          onClose={() => setFriendPickerVisible(false)}
          onConfirm={handleFriendsSelected}
          confirmLabel="Envoyer"
        />
      </SafeAreaView>
    );
  }

  // ===== DÉTAIL D'UN DOCUMENT =====
  if (selectedDoc) {
    const isAudio = selectedDoc.fileType?.startsWith('audio/') === true;

    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setSelectedDoc(null)}>
            <Ionicons name="arrow-back" size={24} color={Colors.light.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{selectedDoc.title}</Text>
          <TouchableOpacity style={styles.iconButton} onPress={() => handleDelete(selectedDoc)}>
            <Ionicons name="trash-outline" size={22} color={Colors.light.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.docMetaBar}>
          <Text style={styles.docMeta}>
            {formatDate(selectedDoc.createdAt)} · {selectedDoc.agentId}
            {selectedDoc.fileType ? ` · ${selectedDoc.fileType.split('/').pop()}` : ''}
          </Text>
        </View>

        <DocumentViewer
          filePath={selectedDoc.filePath}
          fileType={selectedDoc.fileType}
          title={selectedDoc.title}
          content={selectedDoc.content}
        />

        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShareSingleToFriends}>
            <Ionicons name="people-outline" size={20} color={Colors.light.background} />
            <Text style={styles.actionButtonText}>Amis</Text>
          </TouchableOpacity>

          {!isAudio && (
            <TouchableOpacity style={styles.actionButton} onPress={() => handlePrint(selectedDoc)}>
              <Ionicons name="print-outline" size={20} color={Colors.light.background} />
              <Text style={styles.actionButtonText}>Impr.</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(selectedDoc)}>
            <Ionicons name="share-outline" size={20} color={Colors.light.background} />
            <Text style={styles.actionButtonText}>Part.</Text>
          </TouchableOpacity>
        </View>

        <FriendPicker
          visible={friendPickerVisible}
          onClose={() => setFriendPickerVisible(false)}
          onConfirm={async (friendCodes) => {
            handleFriendsSelected(friendCodes);
            setSelectedDoc(null);
          }}
          confirmLabel="Envoyer"
        />
      </SafeAreaView>
    );
  }

  // ===== LISTE =====
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bibliothèque</Text>
        {documents.length > 0 ? (
          <TouchableOpacity style={styles.iconButton} onPress={() => enterSelectionMode()}>
            <Ionicons name="checkbox-outline" size={24} color={Colors.light.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconButton} />
        )}
      </View>

      {/* 🆕 Onglets : Écrits / Audios */}
      <View style={styles.tabsBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'written' && styles.tabButtonActive]}
          onPress={() => setActiveTab('written')}
        >
          <Ionicons
            name="document-text-outline"
            size={18}
            color={activeTab === 'written' ? Colors.light.background : Colors.light.primary}
          />
          <Text
            style={[styles.tabText, activeTab === 'written' && styles.tabTextActive]}
          >
            Écrits ({writtenDocs.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'audio' && styles.tabButtonActive]}
          onPress={() => setActiveTab('audio')}
        >
          <Ionicons
            name="mic-outline"
            size={18}
            color={activeTab === 'audio' ? Colors.light.background : Colors.light.primary}
          />
          <Text
            style={[styles.tabText, activeTab === 'audio' && styles.tabTextActive]}
          >
            Audios ({audioDocs.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={currentDocs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {isLoadingPending && (
              <View style={styles.pendingLoading}>
                <ActivityIndicator color={Colors.light.primary} />
              </View>
            )}

            {pendingDocs.length > 0 && (
              <View style={styles.pendingSection}>
                <Text style={styles.pendingTitle}>
                  📥 En attente ({pendingDocs.length})
                </Text>
                {pendingDocs.map((doc) => (
                  <View key={doc.id} style={styles.pendingItem}>
                    <View style={styles.pendingInfo}>
                      <Text style={styles.pendingItemTitle} numberOfLines={1}>
                        {doc.title}
                      </Text>
                      <Text style={styles.pendingItemMeta}>
                        De {doc.fromName} · {formatDate(doc.sharedAt)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.pendingAccept}
                      onPress={() => handleAccept(doc)}
                    >
                      <Ionicons name="checkmark" size={20} color={Colors.light.background} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pendingRefuse}
                      onPress={() => handleRefuse(doc)}
                    >
                      <Ionicons name="close" size={20} color={Colors.light.background} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {documents.length > 0 && pendingDocs.length > 0 && (
              <Text style={styles.sectionDivider}>Ma bibliothèque</Text>
            )}
          </>
        }
        ListEmptyComponent={
          pendingDocs.length === 0 && currentDocs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={activeTab === 'audio' ? 'mic-outline' : 'book-outline'}
                size={64}
                color={Colors.light.textSecondary}
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'audio' ? 'Aucun audio' : 'Bibliothèque vide'}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === 'audio'
                  ? 'Tes enregistrements audio apparaîtront ici.'
                  : 'Les documents créés par tes agents apparaîtront ici.'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isImage = item.fileType?.startsWith('image/') && item.filePath;
          const isAudio = item.fileType?.startsWith('audio/') === true;

          return (
            <TouchableOpacity
              style={styles.docItem}
              onPress={() => handlePress(item)}
              onLongPress={() => handleLongPress(item)}
            >
              {isImage ? (
                <Image
                  source={{ uri: item.filePath! }}
                  style={styles.docThumbnail}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons
                  name={isAudio ? 'mic-outline' : 'document-text-outline'}
                  size={24}
                  color={Colors.light.primary}
                />
              )}
              <View style={styles.docItemText}>
                <Text style={styles.docItemTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.docItemMeta}>
                  {formatDate(item.createdAt)} · {item.agentId}
                  {item.fileType ? ' · 📎' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  iconButton: { width: 40, alignItems: 'center' },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  docMetaBar: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
  },
  docMeta: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  listContent: { padding: Spacing.three },
  pendingLoading: { padding: Spacing.three, alignItems: 'center' },
  pendingSection: {
    backgroundColor: '#FFF7E6',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: '#FFD580',
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B8651B',
    textTransform: 'uppercase',
    marginBottom: Spacing.two,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  pendingInfo: { flex: 1 },
  pendingItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  pendingItemMeta: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  pendingAccept: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingRefuse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionDivider: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.primary,
    textTransform: 'uppercase',
    marginBottom: Spacing.two,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.five,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: Spacing.three,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundElement,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    gap: Spacing.three,
  },
  docItemSelected: {
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  docThumbnail: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
  },
  checkbox: { padding: Spacing.half },
  docItemText: { flex: 1 },
  docItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  docItemMeta: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: Spacing.half,
  },
  actionBar: {
    flexDirection: 'row',
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.half,
  },
  actionDanger: { backgroundColor: Colors.light.error },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.background,
  },
  // 🆕 Onglets
  tabsBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: Colors.light.backgroundElement,
    gap: Spacing.one,
  },
  tabButtonActive: {
    backgroundColor: Colors.light.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  tabTextActive: {
    color: Colors.light.background,
  },
});