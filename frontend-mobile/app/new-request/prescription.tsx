import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import { createPrescriptionRequest } from '../../lib/api';

const TYPES = [
  { key: 'simples' as const, label: 'Receita Simples', desc: 'Medicamentos sem retenção', price: 50 },
  { key: 'controlado' as const, label: 'Receita Controlada', desc: 'Medicamentos com retenção', price: 80, popular: true },
  { key: 'azul' as const, label: 'Receita Azul', desc: 'Controlados especiais B1 e B2', price: 100 },
];

export default function NewPrescription() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<'simples' | 'controlado' | 'azul'>('simples');
  const [medications, setMedications] = useState<string[]>([]);
  const [medInput, setMedInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addMedication = () => {
    const med = medInput.trim();
    if (med && !medications.includes(med)) {
      setMedications([...medications, med]);
      setMedInput('');
    }
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para fotografar a receita.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const handleSubmit = async () => {
    if (images.length === 0) {
      Alert.alert('Foto necessária', 'Tire uma foto da receita antiga para continuar.');
      return;
    }

    setLoading(true);
    try {
      await createPrescriptionRequest({
        prescriptionType: selectedType,
        medications: medications.length > 0 ? medications : undefined,
        images,
      });
      Alert.alert('Sucesso!', 'Sua solicitação foi enviada. Acompanhe o status na lista de pedidos.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Não foi possível enviar a solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Nova Receita</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Type Selection */}
      <Text style={styles.label}>Tipo de Receita *</Text>
      {TYPES.map(type => (
        <TouchableOpacity
          key={type.key}
          style={[styles.typeCard, selectedType === type.key && styles.typeCardSelected]}
          onPress={() => setSelectedType(type.key)}
          activeOpacity={0.7}
        >
          <View style={styles.typeContent}>
            <View style={styles.typeTextContainer}>
              <View style={styles.typeTitleRow}>
                <Text style={[styles.typeName, selectedType === type.key && styles.typeNameSelected]}>
                  {type.label}
                </Text>
                {type.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>POPULAR</Text>
                  </View>
                )}
              </View>
              <Text style={styles.typeDesc}>{type.desc}</Text>
            </View>
            <Text style={[styles.typePrice, selectedType === type.key && styles.typePriceSelected]}>
              R$ {type.price.toFixed(2).replace('.', ',')}
            </Text>
          </View>
          {selectedType === type.key && (
            <View style={styles.checkIcon}>
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            </View>
          )}
        </TouchableOpacity>
      ))}

      {/* Medications */}
      <Text style={styles.label}>Medicamentos (opcional)</Text>
      <View style={styles.medInputRow}>
        <TextInput
          style={styles.medInput}
          placeholder="Ex: Amoxicilina 500mg"
          placeholderTextColor={colors.textMuted}
          value={medInput}
          onChangeText={setMedInput}
          onSubmitEditing={addMedication}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addButton} onPress={addMedication}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      {medications.length > 0 && (
        <View style={styles.medTags}>
          {medications.map((med, index) => (
            <View key={index} style={styles.medTag}>
              <Text style={styles.medTagText}>{med}</Text>
              <TouchableOpacity onPress={() => removeMedication(index)}>
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Photo */}
      <Text style={styles.label}>Foto da Receita Antiga *</Text>
      <View style={styles.photoRow}>
        <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
          <Ionicons name="camera" size={28} color={colors.primary} />
          <Text style={styles.photoButtonText}>Câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoButton} onPress={pickFromGallery}>
          <Ionicons name="image" size={28} color={colors.primary} />
          <Text style={styles.photoButtonText}>Galeria</Text>
        </TouchableOpacity>
      </View>
      {images.length > 0 && (
        <View style={styles.imagesRow}>
          {images.map((uri, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImage}
                onPress={() => setImages(images.filter((_, i) => i !== index))}
              >
                <Ionicons name="close-circle" size={22} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Info */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          Sua solicitação será analisada por um médico em até 15 minutos. Caso não seja aprovada, o valor será estornado integralmente.
        </Text>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="send" size={20} color="#fff" />
            <Text style={styles.submitText}>Enviar Solicitação</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  typeCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.card,
  },
  typeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
  },
  typeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeTextContainer: {
    flex: 1,
  },
  typeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  typeNameSelected: {
    color: colors.primary,
  },
  popularBadge: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  typeDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  typePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  typePriceSelected: {
    color: colors.primary,
  },
  checkIcon: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  medInputRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  medInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    fontSize: 15,
    color: colors.text,
    ...shadows.card,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  medTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xl,
    gap: spacing.xs,
  },
  medTagText: {
    fontSize: 13,
    color: colors.primaryDark,
    fontWeight: '500',
  },
  photoRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    gap: spacing.md,
  },
  photoButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  photoButtonText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  imagesRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  imageContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
  },
  removeImage: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.surface,
    borderRadius: 11,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
