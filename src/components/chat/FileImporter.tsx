import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export type ImportedFile = {
  type: 'image' | 'document' | 'pdf' | 'text';
  uri: string;
  base64?: string;
  mimeType: string;
  fileName: string;
  title: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onFilePicked: (file: ImportedFile) => void;
};

export default function FileImporter({ visible, onClose, onFilePicked }: Props) {
  const handleGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      onFilePicked({
        type: 'image',
        uri: asset.uri,
        base64: asset.base64 || undefined,
        mimeType: 'image/jpeg',
        fileName: `image_${Date.now()}.jpg`,
        title: `Image du ${new Date().toLocaleDateString('fr-FR')}`,
      });
      onClose();
    } catch (e) {
      console.error('Erreur galerie:', e);
    }
  };

  const handleDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'text/*', 'application/json'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'application/octet-stream';
      const fileName = asset.name.toLowerCase();
      const isPdf = mimeType.includes('pdf') || fileName.endsWith('.pdf');
      const isImage = mimeType.startsWith('image/');
      const isText =
        mimeType.startsWith('text/') ||
        mimeType.includes('json') ||
        fileName.endsWith('.txt') ||
        fileName.endsWith('.md') ||
        fileName.endsWith('.csv') ||
        fileName.endsWith('.json');

      let base64: string | undefined;

      if (isPdf || isImage || isText) {
        try {
          base64 = await (FileSystem as any).readAsStringAsync(asset.uri, {
            encoding: 'base64',
          });
        } catch (e) {
          console.warn('Impossible de lire le base64:', e);
        }
      }

      let type: ImportedFile['type'] = 'document';
      if (isPdf) type = 'pdf';
      else if (isImage) type = 'image';
      else if (isText) type = 'text';

      onFilePicked({
        type,
        uri: asset.uri,
        base64,
        mimeType,
        fileName: asset.name,
        title: asset.name.replace(/\.[^.]+$/, ''),
      });
      onClose();
    } catch (e) {
      console.error('Erreur document:', e);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>Ajouter un fichier</Text>

          <TouchableOpacity style={styles.option} onPress={handleGallery}>
            <Ionicons name="images" size={26} color={Colors.light.primary} />
            <Text style={styles.optionText}>Choisir dans la galerie</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleDocument}>
            <Ionicons name="document" size={26} color={Colors.light.primary} />
            <Text style={styles.optionText}>Choisir un fichier</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Formats supportés : PDF, images, texte (.txt, .md, .csv, .json)
          </Text>

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
    marginBottom: Spacing.three,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundElement,
    padding: Spacing.four,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    gap: Spacing.three,
  },
  optionText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.two,
    fontStyle: 'italic',
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