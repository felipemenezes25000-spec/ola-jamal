import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ZoomableImage } from '../../components/ZoomableImage';
import { createPrescriptionRequest } from '../../lib/api';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

const MAX_IMAGES = 5;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB

const TYPES = [
  { key: 'simples', label: 'Simples', desc: 'Receita branca comum', price: 'R$ 29,90', icon: 'document-text' as const },
  { key: 'controlado', label: 'Controlada', desc: 'Receita com tarja vermelha', price: 'R$ 49,90', icon: 'alert-circle' as const },
  { key: 'azul', label: 'Azul (B)', desc: 'Receita azul especial', price: 'R$ 129,90', icon: 'shield' as const },
];

export default function PrescriptionScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const addImages = (newUris: string[]) => {
    setImages(prev => {
      const combined = [...prev, ...newUris].slice(0, MAX_IMAGES);
      if (combined.length > MAX_IMAGES) {
        Alert.alert('Limite de imagens', `Máximo de ${MAX_IMAGES} imagens permitidas.`);
      }
      return combined.slice(0, MAX_IMAGES);
    });
  };

  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limite atingido', `Máximo de ${MAX_IMAGES} imagens (10 MB no total).`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: true });
    if (!result.canceled) {
      const toAdd = result.assets.slice(0, MAX_IMAGES - images.length).map(a => a.uri);
      addImages(toAdd);
    }
  };

  const takePhoto = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limite atingido', `Máximo de ${MAX_IMAGES} imagens (10 MB no total).`);
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissão necessária', 'Permita o acesso à câmera.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) addImages([result.assets[0].uri]);
  };

  const pickDocument = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limite atingido', `Máximo de ${MAX_IMAGES} arquivos (10 MB no total).`);
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (result.canceled) return;
    addImages([result.assets[0].uri]);
  };

  const getTotalSize = async (uris: string[]): Promise<number> => {
    let total = 0;
    for (const uri of uris) {
      try {
        const info = await FileSystem.getInfoAsync(uri, { size: true });
        if (info.exists && 'size' in info) total += info.size;
      } catch {
        // Se não conseguir obter tamanho, ignoramos (backend validará)
      }
    }
    return total;
  };

  const handleSubmit = async () => {
    if (!selectedType) { Alert.alert('Atenção', 'Selecione o tipo de receita'); return; }
    if (images.length === 0) { Alert.alert('Atenção', 'Envie pelo menos uma foto da receita anterior'); return; }
    if (images.length > MAX_IMAGES) {
      Alert.alert('Limite de imagens', `Máximo de ${MAX_IMAGES} imagens permitidas.`);
      return;
    }
    const totalSize = await getTotalSize(images);
    if (totalSize > MAX_TOTAL_BYTES) {
      Alert.alert('Tamanho excedido', `O total das imagens (${(totalSize / (1024 * 1024)).toFixed(1)} MB) excede 10 MB. Remova alguma imagem ou use imagens menores.`);
      return;
    }
    setLoading(true);
    try {
      const result = await createPrescriptionRequest({ prescriptionType: selectedType as any, images });
      if (result.payment) {
        router.replace(`/payment/${result.payment.id}`);
      } else {
        Alert.alert('Sucesso', 'Solicitação enviada! Aguarde a análise.', [
          { text: 'OK', onPress: () => router.replace('/(patient)/requests') }
        ]);
      }
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao criar solicitação');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.primaryDark} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Receita</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Step 1: Type */}
        <Text style={styles.stepLabel}>1. Tipo de Receita</Text>
        {TYPES.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setSelectedType(t.key)}>
            <Card style={[styles.typeCard, selectedType === t.key && styles.typeCardActive]}>
              <View style={styles.typeRow}>
                <View style={[styles.typeIcon, selectedType === t.key && { backgroundColor: colors.primary }]}>
                  <Ionicons name={t.icon} size={20} color={selectedType === t.key ? colors.white : colors.primary} />
                </View>
                <View style={styles.typeInfo}>
                  <Text style={styles.typeLabel}>{t.label}</Text>
                  <Text style={styles.typeDesc}>{t.desc}</Text>
                </View>
                <Text style={[styles.typePrice, selectedType === t.key && { color: colors.primary }]}>{t.price}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))}

        {/* Step 2: Upload */}
        <Text style={[styles.stepLabel, { marginTop: spacing.lg }]}>2. Foto da Receita Anterior (máx. 5 arquivos: PNG, JPG, HEIC, PDF – 10 MB total)</Text>
        <View style={styles.uploadRow}>
          <TouchableOpacity style={styles.uploadBtn} onPress={takePhoto}>
            <Ionicons name="camera" size={28} color={colors.primary} />
            <Text style={styles.uploadText}>Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
            <Ionicons name="images" size={28} color={colors.primary} />
            <Text style={styles.uploadText}>Galeria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument}>
            <Ionicons name="document" size={28} color={colors.primary} />
            <Text style={styles.uploadText}>PDF</Text>
          </TouchableOpacity>
        </View>

        {images.length > 0 && (
          <View style={styles.previewRow}>
            {images.map((uri, i) => (
              <View key={i} style={styles.previewItem}>
                <TouchableOpacity onPress={() => setFullScreenImage(uri)} activeOpacity={0.9}>
                  <Image source={{ uri }} style={styles.previewImg} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeBtn} onPress={() => setImages(prev => prev.filter((_, idx) => idx !== i))}>
                  <Ionicons name="close-circle" size={22} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Modal visible={!!fullScreenImage} transparent animationType="fade">
          <GestureHandlerRootView style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {fullScreenImage && <ZoomableImage uri={fullScreenImage} key={fullScreenImage} />}
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setFullScreenImage(null)}>
              <Ionicons name="close-circle" size={40} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.modalHint}>Pinch para zoom • Duplo toque para ampliar</Text>
          </GestureHandlerRootView>
        </Modal>

        <View style={styles.infoBox}>
          <Ionicons name="sparkles" size={18} color={colors.secondary} />
          <Text style={styles.infoText}>Nossa IA analisará a foto para extrair os dados automaticamente.</Text>
        </View>

        <Button title="Enviar Solicitação" onPress={handleSubmit} loading={loading} fullWidth style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { ...typography.h4, color: colors.primaryDarker },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  stepLabel: { ...typography.bodySemiBold, color: colors.primaryDarker, marginBottom: spacing.sm },
  typeCard: { marginBottom: spacing.sm, borderWidth: 2, borderColor: 'transparent' },
  typeCardActive: { borderColor: colors.primary },
  typeRow: { flexDirection: 'row', alignItems: 'center' },
  typeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryPaler, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  typeInfo: { flex: 1 },
  typeLabel: { ...typography.bodySmallMedium, color: colors.gray800 },
  typeDesc: { ...typography.caption, color: colors.gray500 },
  typePrice: { ...typography.bodySemiBold, color: colors.gray700 },
  uploadRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  uploadBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 2, borderColor: colors.gray200, borderStyle: 'dashed', borderRadius: borderRadius.xl, paddingVertical: spacing.xl, ...shadows.sm },
  uploadText: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
  previewRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  previewItem: { position: 'relative' },
  previewImg: { width: 80, height: 80, borderRadius: borderRadius.md },
  removeBtn: { position: 'absolute', top: -6, right: -6 },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm },
  infoText: { flex: 1, ...typography.bodySmall, color: colors.gray600 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { flex: 1, width: '100%', justifyContent: 'center' },
  modalCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  modalHint: { ...typography.caption, color: colors.gray400, position: 'absolute', bottom: 40 },
});
