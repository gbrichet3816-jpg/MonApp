import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteDocument, Document, loadDocuments } from '@/config/database';
import { printPdf, sharePdf } from '@/config/pdf';
import { Colors, Spacing } from '@/constants/theme';

export default function LibraryScreen() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = () => {
    const docs = loadDocuments();
    setDocuments(docs);
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
          onPress: () => {
            deleteDocument(doc.id);
            setSelectedDoc(null);
            loadAll();
          },
        },
      ],
    );
  };

  const handlePrint = async (doc: Document) => {
    const success = await printPdf({
      title: doc.title,
      content: doc.content,
      agentId: doc.agentId,
    });
    if (!success) {
      Alert.alert('Erreur', "Impossible d'ouvrir le lecteur d'impression.");
    }
  };

  const handleShare = async (doc: Document) => {
    const success = await sharePdf({
      title: doc.title,
      content: doc.content,
      agentId: doc.agentId,
    });
    if (!success) {
      Alert.alert('Erreur', 'Impossible de partager le document.');
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  if (selectedDoc) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setSelectedDoc(null)}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.light.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {selectedDoc.title}
          </Text>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => handleDelete(selectedDoc)}
          >
            <Ionicons name="trash-outline" size={22} color={Colors.light.error} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={[selectedDoc]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.docContent}>
              <Text style={styles.docMeta}>
                {formatDate(item.createdAt)} · {item.agentId}
              </Text>
              <Text style={styles.docText}>{item.content}</Text>
            </View>
          )}
        />

        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePrint(selectedDoc)}
          >
            <Ionicons name="print-outline" size={22} color={Colors.light.background} />
            <Text style={styles.actionButtonText}>Imprimer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleShare(selectedDoc)}
          >
            <Ionicons name="share-outline" size={22} color={Colors.light.background} />
            <Text style={styles.actionButtonText}>Partager</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Bibliothèque</Text>
        <View style={styles.iconButton} />
      </View>

      {documents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={64} color={Colors.light.textSecondary} />
          <Text style={styles.emptyTitle}>Bibliothèque vide</Text>
          <Text style={styles.emptyText}>
            Les documents créés par tes agents apparaîtront ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.docItem}
              onPress={() => setSelectedDoc(item)}
            >
              <Ionicons
                name="document-text-outline"
                size={24}
                color={Colors.light.primary}
              />
              <View style={styles.docItemText}>
                <Text style={styles.docItemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.docItemMeta}>
                  {formatDate(item.createdAt)} · {item.agentId}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.light.textSecondary}
              />
            </TouchableOpacity>
          )}
        />
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
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
  listContent: {
    padding: Spacing.three,
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
  docItemText: {
    flex: 1,
  },
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
  docContent: {
    padding: Spacing.four,
  },
  docMeta: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.three,
  },
  docText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.light.text,
  },
  actionBar: {
    flexDirection: 'row',
    padding: Spacing.three,
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
    gap: Spacing.two,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.background,
  },
});