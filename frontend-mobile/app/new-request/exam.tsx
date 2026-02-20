import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../lib/theme';
import { createExamRequest } from '../../lib/api';
import { FALLBACK_EXAM_PRICE } from '../../lib/config/pricing';
import { getApiErrorMessage } from '../../lib/api-client';
import { validate } from '../../lib/validation';
import { createExamSchema } from '../../lib/validation/schemas';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';

const c = theme.colors;
const s = theme.spacing;
const r = theme.borderRadius;
const ty = theme.typography;

const EXAM_TYPES = [
  { key: 'laboratorial', label: 'Laboratorial', desc: 'Exames de sangue, urina, etc.', icon: 'flask' as const },
  { key: 'imagem', label: 'Imagem', desc: 'Raio-X, ultrassom, tomografia, etc.', icon: 'scan' as const },
];

export default function NewExam() {
  const router = useRouter();
  const [examType, setExamType] = useState('laboratorial');
  const [exams, setExams] = useState<string[]>([]);
  const [examInput, setExamInput] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addExam = () => {
    const exam = examInput.trim();
    if (exam && !exams.includes(exam)) {
      setExams([...exams, exam]);
      setExamInput('');
    }
  };

  const removeExam = (index: number) => {
    setExams(exams.filter((_, i) => i !== index));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const handleSubmit = async () => {
    const validation = validate(createExamSchema, {
      examType,
      exams,
      symptoms,
      images,
    });
    if (!validation.success) {
      Alert.alert('Exames necessários', validation.firstError ?? 'Informe pelo menos um exame desejado.');
      return;
    }

    setLoading(true);
    try {
      const result = await createExamRequest({
        examType: validation.data!.examType ?? 'laboratorial',
        exams: validation.data!.exams ?? [],
        symptoms: validation.data!.symptoms || undefined,
        images: (validation.data!.images?.length ?? 0) > 0 ? validation.data!.images : undefined,
      });
      // A IA analisa na hora – se rejeitou (imagem incoerente), avisar imediatamente
      if (result.request?.status === 'rejected') {
        const msg =
          result.request.aiMessageToUser ||
          result.request.rejectionReason ||
          'A imagem não parece ser de pedido de exame ou laudo médico. Envie apenas fotos do documento.';
        Alert.alert(
          'Imagem não reconhecida',
          msg,
          [{ text: 'Entendi', style: 'default' }]
        );
        return;
      }
      Alert.alert('Sucesso!', 'Seu pedido de exame foi enviado.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      Alert.alert('Erro', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll padding={false} edges={['bottom']}>
      <AppHeader title="Novo Exame" />

      <View style={styles.body}>
        {/* Exam Type */}
        <Text style={styles.overline}>TIPO DE EXAME</Text>
        <View style={styles.typeRow}>
          {EXAM_TYPES.map(type => (
            <AppCard
              key={type.key}
              selected={examType === type.key}
              onPress={() => setExamType(type.key)}
              style={styles.typeCard}
            >
              <Ionicons
                name={type.icon}
                size={28}
                color={examType === type.key ? c.primary.main : c.text.tertiary}
              />
              <Text style={[styles.typeName, examType === type.key && styles.typeNameSelected]}>
                {type.label}
              </Text>
              <Text style={styles.typeDesc}>{type.desc}</Text>
            </AppCard>
          ))}
        </View>

        {/* Exams List */}
        <Text style={styles.overline}>EXAMES DESEJADOS</Text>
        <View style={styles.inputRow}>
          <AppInput
            placeholder="Ex: Hemograma completo"
            value={examInput}
            onChangeText={setExamInput}
            onSubmitEditing={addExam}
            returnKeyType="done"
            containerStyle={styles.inputContainer}
          />
          <TouchableOpacity style={styles.addButton} onPress={addExam}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        {exams.length > 0 && (
          <View style={styles.tags}>
            {exams.map((exam, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{exam}</Text>
                <TouchableOpacity onPress={() => removeExam(index)}>
                  <Ionicons name="close" size={16} color={c.accent.dark} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Symptoms */}
        <Text style={styles.overline}>SINTOMAS</Text>
        <TextInput
          style={styles.textarea}
          placeholder="Descreva seus sintomas (opcional)..."
          placeholderTextColor={c.text.tertiary}
          value={symptoms}
          onChangeText={setSymptoms}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Photo */}
        <Text style={styles.overline}>FOTO</Text>
        <Text style={styles.photoHint}>
          Envie apenas fotos do documento (pedido de exame ou laudo). Fotos de pessoas, animais ou outros objetos serão rejeitadas.
        </Text>
        <View style={styles.photoRow}>
          <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
            <Ionicons name="camera" size={28} color={c.primary.main} />
            <Text style={styles.photoText}>Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={pickFromGallery}>
            <Ionicons name="image" size={28} color={c.primary.main} />
            <Text style={styles.photoText}>Galeria</Text>
          </TouchableOpacity>
        </View>
        {images.length > 0 && (
          <View style={styles.imagesRow}>
            {images.map((uri, i) => (
              <View key={i} style={styles.imgWrap}>
                <Image source={{ uri }} style={styles.imgPreview} />
                <TouchableOpacity
                  style={styles.imgRemove}
                  onPress={() => setImages(images.filter((_, j) => j !== i))}
                >
                  <Ionicons name="close-circle" size={20} color={c.status.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Price Info */}
        <View style={styles.priceBox}>
          <Ionicons name="pricetag" size={18} color={c.secondary.main} />
          <Text style={styles.priceText}>
            Valor do pedido de exame:{' '}
            <Text style={styles.priceValue}>R$ {FALLBACK_EXAM_PRICE.toFixed(2).replace('.', ',')}</Text>
          </Text>
        </View>

        {/* Submit */}
        <AppButton
          title="Enviar Pedido"
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
    paddingHorizontal: theme.layout.screen.paddingHorizontal,
  },
  overline: {
    fontSize: ty.fontSize.xs,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: c.text.secondary,
    marginTop: s.lg,
    marginBottom: s.sm,
  },
  typeRow: {
    flexDirection: 'row',
    gap: s.sm,
  },
  typeCard: {
    flex: 1,
    alignItems: 'center',
  },
  typeName: {
    fontSize: ty.fontSize.sm,
    fontWeight: '600',
    color: c.text.primary,
    marginTop: s.sm,
  },
  typeNameSelected: {
    color: c.primary.main,
  },
  typeDesc: {
    fontSize: ty.fontSize.xs,
    color: c.text.tertiary,
    textAlign: 'center',
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  inputContainer: {
    flex: 1,
    marginBottom: 0,
  },
  addButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: c.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.button,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: s.sm,
    gap: s.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.accent.soft,
    paddingHorizontal: s.md,
    paddingVertical: s.xs,
    borderRadius: r.pill,
    gap: s.xs,
  },
  tagText: {
    fontSize: 13,
    color: c.accent.dark,
    fontWeight: '500',
  },
  textarea: {
    backgroundColor: c.background.paper,
    borderRadius: r.md,
    padding: s.md,
    fontSize: ty.fontSize.md,
    color: c.text.primary,
    minHeight: 100,
    ...theme.shadows.card,
  },
  photoHint: {
    fontSize: 12,
    color: c.text.tertiary,
    marginBottom: s.sm,
  },
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
    borderWidth: 2,
    borderColor: c.border.main,
    borderStyle: 'dashed',
    gap: s.xs,
    ...theme.shadows.sm,
  },
  photoText: {
    fontSize: 13,
    color: c.primary.main,
    fontWeight: '600',
  },
  imagesRow: {
    flexDirection: 'row',
    marginTop: s.sm,
    gap: s.sm,
  },
  imgWrap: {
    position: 'relative',
  },
  imgPreview: {
    width: 80,
    height: 80,
    borderRadius: 14,
  },
  imgRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: c.background.paper,
    borderRadius: 10,
  },
  priceBox: {
    flexDirection: 'row',
    backgroundColor: c.secondary.soft,
    marginTop: s.lg,
    padding: s.md,
    borderRadius: r.lg,
    gap: s.sm,
    alignItems: 'center',
  },
  priceText: {
    fontSize: ty.fontSize.sm,
    color: c.text.primary,
  },
  priceValue: {
    fontWeight: '700',
    color: c.secondary.main,
  },
  submitButton: {
    marginTop: s.lg,
  },
});
