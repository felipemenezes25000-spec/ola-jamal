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
import { createExamRequest } from '../../lib/api';

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
    if (exams.length === 0) {
      Alert.alert('Exames necessários', 'Informe pelo menos um exame desejado.');
      return;
    }

    setLoading(true);
    try {
      await createExamRequest({
        examType,
        exams,
        symptoms: symptoms.trim() || undefined,
        images: images.length > 0 ? images : undefined,
      });
      Alert.alert('Sucesso!', 'Seu pedido de exame foi enviado.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Não foi possível enviar o pedido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Novo Exame</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Exam Type */}
      <Text style={styles.label}>Tipo de Exame *</Text>
      <View style={styles.typeRow}>
        {EXAM_TYPES.map(type => (
          <TouchableOpacity
            key={type.key}
            style={[styles.typeCard, examType === type.key && styles.typeCardSelected]}
            onPress={() => setExamType(type.key)}
          >
            <Ionicons name={type.icon} size={28} color={examType === type.key ? colors.primary : colors.textSecondary} />
            <Text style={[styles.typeName, examType === type.key && styles.typeNameSelected]}>{type.label}</Text>
            <Text style={styles.typeDesc}>{type.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Exams List */}
      <Text style={styles.label}>Exames Desejados *</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ex: Hemograma completo"
          placeholderTextColor={colors.textMuted}
          value={examInput}
          onChangeText={setExamInput}
          onSubmitEditing={addExam}
          returnKeyType="done"
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
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Symptoms */}
      <Text style={styles.label}>Sintomas (opcional)</Text>
      <TextInput
        style={styles.textarea}
        placeholder="Descreva seus sintomas..."
        placeholderTextColor={colors.textMuted}
        value={symptoms}
        onChangeText={setSymptoms}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {/* Photo */}
      <Text style={styles.label}>Foto de pedido anterior (opcional)</Text>
      <View style={styles.photoRow}>
        <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
          <Ionicons name="camera" size={24} color={colors.primary} />
          <Text style={styles.photoText}>Câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoButton} onPress={pickFromGallery}>
          <Ionicons name="image" size={24} color={colors.primary} />
          <Text style={styles.photoText}>Galeria</Text>
        </TouchableOpacity>
      </View>
      {images.length > 0 && (
        <View style={styles.imagesRow}>
          {images.map((uri, i) => (
            <View key={i} style={styles.imgWrap}>
              <Image source={{ uri }} style={styles.imgPreview} />
              <TouchableOpacity style={styles.imgRemove} onPress={() => setImages(images.filter((_, j) => j !== i))}>
                <Ionicons name="close-circle" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Price Info */}
      <View style={styles.priceBox}>
        <Ionicons name="pricetag" size={18} color={colors.success} />
        <Text style={styles.priceText}>Valor do pedido de exame: <Text style={styles.priceValue}>R$ 60,00</Text></Text>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, loading && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="send" size={20} color="#fff" />
            <Text style={styles.submitText}>Enviar Pedido</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  label: { fontSize: 15, fontWeight: '600', color: colors.text, marginHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm },
  typeRow: { flexDirection: 'row', marginHorizontal: spacing.md, gap: spacing.sm },
  typeCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md,
    alignItems: 'center', borderWidth: 2, borderColor: 'transparent', ...shadows.card,
  },
  typeCardSelected: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  typeName: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  typeNameSelected: { color: colors.primary },
  typeDesc: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  inputRow: { flexDirection: 'row', marginHorizontal: spacing.md, gap: spacing.sm },
  input: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingHorizontal: spacing.md,
    height: 44, fontSize: 15, color: colors.text, ...shadows.card,
  },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: spacing.md, marginTop: spacing.sm, gap: spacing.sm },
  tag: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDE9FE', paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs, borderRadius: borderRadius.xl, gap: spacing.xs,
  },
  tagText: { fontSize: 13, color: '#7C3AED', fontWeight: '500' },
  textarea: {
    backgroundColor: colors.surface, marginHorizontal: spacing.md, borderRadius: borderRadius.md,
    padding: spacing.md, fontSize: 15, color: colors.text, minHeight: 100, ...shadows.card,
  },
  photoRow: { flexDirection: 'row', marginHorizontal: spacing.md, gap: spacing.md },
  photoButton: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg,
    alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', gap: spacing.xs,
  },
  photoText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  imagesRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: spacing.sm, gap: spacing.sm },
  imgWrap: { position: 'relative' },
  imgPreview: { width: 70, height: 70, borderRadius: borderRadius.sm },
  imgRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: colors.surface, borderRadius: 10 },
  priceBox: {
    flexDirection: 'row', backgroundColor: '#D1FAE5', marginHorizontal: spacing.md, marginTop: spacing.lg,
    padding: spacing.md, borderRadius: borderRadius.md, gap: spacing.sm, alignItems: 'center',
  },
  priceText: { fontSize: 14, color: colors.text },
  priceValue: { fontWeight: '700', color: colors.success },
  submitButton: {
    flexDirection: 'row', backgroundColor: colors.primary, marginHorizontal: spacing.md, marginTop: spacing.lg,
    padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 52,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
