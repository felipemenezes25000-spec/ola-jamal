import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../lib/theme';
import { createPrescriptionRequest } from '../../lib/api';
import { validate } from '../../lib/validation';
import { createPrescriptionSchema } from '../../lib/validation/schemas';
import { PRESCRIPTION_TYPE_PRICES } from '../../lib/config/pricing';
import { getApiErrorMessage } from '../../lib/api-client';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { AppCard } from '../../components/ui/AppCard';

const t = theme;
const c = t.colors;
const s = t.spacing;
const r = t.borderRadius;
const typo = t.typography;

const TYPES = [
  { key: 'simples' as const, label: 'Receita Simples', desc: 'Medicamentos sem retenção', price: PRESCRIPTION_TYPE_PRICES.simples },
  { key: 'controlado' as const, label: 'Receita Controlada', desc: 'Medicamentos com retenção', price: PRESCRIPTION_TYPE_PRICES.controlado, popular: true },
  { key: 'azul' as const, label: 'Receita Azul', desc: 'Controlados especiais B1 e B2', price: PRESCRIPTION_TYPE_PRICES.azul },
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
      const result = await createPrescriptionRequest({
        prescriptionType: selectedType,
        medications: medications.length > 0 ? medications : undefined,
        images,
      });
      // A IA analisa na hora – se rejeitou, avisar imediatamente (não dizer sucesso)
      if (result.request?.status === 'rejected') {
        const msg =
          result.request.aiMessageToUser ||
          result.request.rejectionReason ||
          'A imagem não parece ser de uma receita médica. Envie apenas fotos do documento da receita (papel ou tela com medicamentos).';
        Alert.alert(
          'Imagem não reconhecida',
          msg,
          [{ text: 'Entendi', style: 'default' }]
        );
        return;
      }
      Alert.alert('Sucesso!', 'Sua solicitação foi enviada. Acompanhe o status na lista de pedidos.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      Alert.alert('Erro', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll edges={['bottom']} padding={false}>
      <AppHeader title="Nova Receita" />

      <View style={styles.body}>
        {/* Type Selection */}
        <Text style={styles.sectionLabel}>TIPO DE RECEITA</Text>
        {TYPES.map(type => (
          <AppCard
            key={type.key}
            selected={selectedType === type.key}
            onPress={() => setSelectedType(type.key)}
            style={styles.typeCard}
          >
            <View style={styles.typeContent}>
              <View style={styles.typeTextContainer}>
                <View style={styles.typeTitleRow}>
                  <Text
                    style={[
                      styles.typeName,
                      selectedType === type.key && styles.typeNameSelected,
                    ]}
                  >
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
              <View style={styles.typePriceContainer}>
                <Text
                  style={[
                    styles.typePrice,
                    selectedType === type.key && styles.typePriceSelected,
                  ]}
                >
                  R$ {type.price.toFixed(2).replace('.', ',')}
                </Text>
              </View>
            </View>
            {selectedType === type.key && (
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark-circle" size={24} color={c.primary.main} />
              </View>
            )}
          </AppCard>
        ))}

        {/* Medications */}
        <Text style={styles.sectionLabel}>MEDICAMENTOS</Text>
        <View style={styles.medInputRow}>
          <AppInput
            placeholder="Ex: Amoxicilina 500mg"
            value={medInput}
            onChangeText={setMedInput}
            onSubmitEditing={addMedication}
            returnKeyType="done"
            containerStyle={styles.medInputContainer}
          />
          <TouchableOpacity style={styles.addButton} onPress={addMedication}>
            <Ionicons name="add" size={24} color={c.primary.contrast} />
          </TouchableOpacity>
        </View>
        {medications.length > 0 && (
          <View style={styles.medTags}>
            {medications.map((med, index) => (
              <View key={index} style={styles.medTag}>
                <Text style={styles.medTagText}>{med}</Text>
                <TouchableOpacity onPress={() => removeMedication(index)}>
                  <Ionicons name="close" size={16} color={c.primary.dark} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Photo */}
        <Text style={styles.sectionLabel}>FOTO DA RECEITA</Text>
        <Text style={styles.photoHint}>
          Envie APENAS fotos do documento da receita (papel ou tela com medicamentos). Fotos de
          pessoas, animais ou outros objetos serão rejeitadas automaticamente.
        </Text>
        <View style={styles.photoRow}>
          <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
            <View style={styles.photoIconCircle}>
              <Ionicons name="camera" size={26} color={c.primary.main} />
            </View>
            <Text style={styles.photoButtonText}>Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={pickFromGallery}>
            <View style={styles.photoIconCircle}>
              <Ionicons name="image" size={26} color={c.primary.main} />
            </View>
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
                  <Ionicons name="close-circle" size={22} color={c.status.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={c.status.info} />
          <Text style={styles.infoText}>
            Sua solicitação será analisada por um médico em até 15 minutos. Caso não seja aprovada,
            o valor será estornado integralmente.
          </Text>
        </View>

        {/* Submit */}
        <AppButton
          title="Enviar Solicitação"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          fullWidth
          icon="send"
          style={styles.submitButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: t.layout.screen.paddingHorizontal,
  },
  sectionLabel: {
    ...typo.variants.overline,
    color: c.text.secondary,
    marginTop: s.lg,
    marginBottom: s.sm,
  } as any,
  typeCard: {
    marginBottom: s.sm,
    position: 'relative',
  },
  typeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeTextContainer: {
    flex: 1,
    marginRight: s.sm,
  },
  typeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  typeName: {
    fontSize: typo.fontSize.md,
    fontWeight: typo.fontWeight.semibold,
    color: c.text.primary,
  },
  typeNameSelected: {
    color: c.primary.main,
  },
  popularBadge: {
    backgroundColor: c.primary.dark,
    paddingHorizontal: s.sm,
    paddingVertical: 2,
    borderRadius: r.full,
  },
  popularText: {
    fontSize: typo.fontSize.xs,
    fontWeight: typo.fontWeight.bold,
    color: c.primary.contrast,
  },
  typeDesc: {
    fontSize: typo.variants.caption.fontSize,
    color: c.text.secondary,
    marginTop: 2,
  },
  typePriceContainer: {
    alignItems: 'flex-end',
  },
  typePrice: {
    fontSize: typo.fontSize.lg,
    fontWeight: typo.fontWeight.bold,
    color: c.text.primary,
  },
  typePriceSelected: {
    color: c.primary.main,
  },
  checkIcon: {
    position: 'absolute',
    top: s.sm,
    right: s.sm,
  },
  medInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s.sm,
  },
  medInputContainer: {
    flex: 1,
    marginBottom: 0,
  },
  addButton: {
    width: t.layout.height.input,
    height: t.layout.height.input,
    borderRadius: t.layout.height.input / 2,
    backgroundColor: c.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadows.button,
  },
  medTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: s.sm,
    gap: s.sm,
  },
  medTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.primary.soft,
    paddingHorizontal: s.md,
    paddingVertical: s.xs,
    borderRadius: r.full,
    gap: s.xs,
  },
  medTagText: {
    fontSize: typo.variants.caption.fontSize,
    color: c.primary.dark,
    fontWeight: typo.fontWeight.medium,
  },
  photoHint: {
    ...typo.variants.caption,
    color: c.text.tertiary,
    marginBottom: s.sm,
  } as any,
  photoRow: {
    flexDirection: 'row',
    gap: s.md,
  },
  photoButton: {
    flex: 1,
    backgroundColor: c.background.paper,
    borderRadius: 18,
    paddingVertical: s.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.border.main,
    borderStyle: 'dashed',
    gap: s.sm,
    ...t.shadows.sm,
  },
  photoIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonText: {
    fontSize: typo.fontSize.sm,
    color: c.primary.main,
    fontWeight: typo.fontWeight.semibold,
  },
  imagesRow: {
    flexDirection: 'row',
    marginTop: s.sm,
    gap: s.sm,
  },
  imageContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: 88,
    height: 88,
    borderRadius: 14,
  },
  removeImage: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: c.background.paper,
    borderRadius: r.full,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: c.status.infoLight,
    marginTop: s.lg,
    padding: s.md,
    borderRadius: r.lg,
    gap: s.sm,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    ...typo.variants.caption,
    color: c.text.secondary,
    lineHeight: 18,
  } as any,
  submitButton: {
    marginTop: s.lg,
  },
});
