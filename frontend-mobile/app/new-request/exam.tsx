import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { createExamRequest } from '../../lib/api';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function ExamScreen() {
  const router = useRouter();
  const [examType, setExamType] = useState('laboratorial');
  const [exams, setExams] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) setImages(prev => [...prev, result.assets[0].uri]);
  };

  const handleSubmit = async () => {
    const examList = exams.split('\n').map(e => e.trim()).filter(Boolean);
    if (examList.length === 0 && images.length === 0 && !symptoms) {
      Alert.alert('Atenção', 'Informe pelo menos um exame, imagem ou sintoma');
      return;
    }
    setLoading(true);
    try {
      const result = await createExamRequest({ examType, exams: examList, symptoms: symptoms || undefined, images: images.length > 0 ? images : undefined });
      if (result.payment) router.replace(`/payment/${result.payment.id}`);
      else Alert.alert('Sucesso', 'Solicitação enviada!', [{ text: 'OK', onPress: () => router.replace('/(patient)/requests') }]);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao criar solicitação');
    } finally { setLoading(false); }
  };

  const types = [
    { key: 'laboratorial', label: 'Laboratorial', icon: 'flask' as const },
    { key: 'imagem', label: 'Imagem', icon: 'scan' as const },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.primaryDark} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Exame</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.stepLabel}>Tipo de Exame</Text>
        <View style={styles.typeRow}>
          {types.map(t => (
            <TouchableOpacity key={t.key} style={[styles.typeBtn, examType === t.key && styles.typeBtnActive]} onPress={() => setExamType(t.key)}>
              <Ionicons name={t.icon} size={22} color={examType === t.key ? colors.white : colors.primary} />
              <Text style={[styles.typeText, examType === t.key && { color: colors.white }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input label="Exames desejados (um por linha)" placeholder="Hemograma&#10;Glicemia&#10;TSH" value={exams} onChangeText={setExams} multiline numberOfLines={4} style={{ minHeight: 100, textAlignVertical: 'top' }} />
        <Input label="Sintomas ou indicação (opcional)" placeholder="Descreva seus sintomas..." value={symptoms} onChangeText={setSymptoms} multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} />

        <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
          <Ionicons name="camera" size={24} color={colors.primary} />
          <Text style={styles.uploadText}>Anexar pedido anterior (opcional)</Text>
        </TouchableOpacity>
        {images.length > 0 && <Text style={styles.imageCount}>{images.length} imagem(ns) anexada(s)</Text>}

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
  typeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.gray200 },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { ...typography.bodySmallMedium, color: colors.gray700 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.gray200, borderStyle: 'dashed', borderRadius: borderRadius.xl, padding: spacing.lg },
  uploadText: { ...typography.bodySmall, color: colors.primary },
  imageCount: { ...typography.caption, color: colors.success, marginTop: spacing.xs, textAlign: 'center' },
});
