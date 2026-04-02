import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { createExamRequest, evaluateAssistantCompleteness } from '../../lib/api';
import { showToast } from '../../components/ui/Toast';
import { useInvalidateRequests } from '../../lib/hooks/useRequestsQuery';
import { getApiErrorMessage } from '../../lib/api-client';
import { isDuplicateRequestError } from '../../lib/hooks/useCreateRequest';
import { validate } from '../../lib/validation';
import { createExamSchema } from '../../lib/validation/schemas';
import { useStickyCtaScrollPadding } from '../../lib/ui/responsive';
import { Screen } from '../../components/ui/Screen';
import { AppHeader, AppCard, AppInput, StepIndicator, StickyCTA } from '../../components/ui';
import { CompatibleImage } from '../../components/CompatibleImage';
import { useTriageEval } from '../../hooks/useTriageEval';
import { detectRedFlags, evaluateExamCompleteness } from '../../lib/domain/assistantIntelligence';

const s = theme.spacing;
const _r = theme.borderRadius;
const ty = theme.typography;

const EXAM_TYPES = [
  { key: 'laboratorial' as const, label: 'Laboratorial', desc: 'Exames de sangue, urina e outros.', icon: 'flask-outline' as const, accent: '#22C55E' },
  { key: 'imagem' as const, label: 'Imagem', desc: 'Raio-X, ultrassom, tomografia.', icon: 'scan-outline' as const, accent: '#0EA5E9' },
];

const QUICK_EXAMS = [
  'Hemograma completo',
  'Glicemia em jejum',
  'TSH',
  'Colesterol total',
  'TGO / TGP',
  'Creatinina',
];

export default function NewExam() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prefillExams?: string }>();
  const invalidateRequests = useInvalidateRequests();
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const [examType, setExamType] = useState('laboratorial');
  const [exams, setExams] = useState<string[]>([]);
  const [examInput, setExamInput] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, narrow), [colors, narrow]);
  const listPadding = useStickyCtaScrollPadding();
  const completenessLocal = evaluateExamCompleteness({
    examType,
    examsCount: exams.length,
    symptoms,
    imagesCount: images.length,
  });
  const redFlagsLocal = detectRedFlags(symptoms);
  const [apiLoading, setApiLoading] = useState(false);

  useEffect(() => {
    const raw = params.prefillExams;
    if (raw && typeof raw === 'string') {
      try {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr) && arr.length > 0) {
          setExams(arr.filter(Boolean));
        }
      } catch { /* ignore */ }
    }
  }, [params.prefillExams]);

  const [apiResult, setApiResult] = useState<{
    score: number;
    doneCount: number;
    totalCount: number;
    items: { id: string; label: string; required: boolean; done: boolean }[];
    missingRequired: { id: string; label: string; required: boolean; done: boolean }[];
    hasUrgencyRisk: boolean;
    urgencySignals: string[];
    urgencyMessage: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      setApiLoading(true);
      evaluateAssistantCompleteness({
        flow: 'exam',
        examType,
        examsCount: exams.length,
        symptoms,
        imagesCount: images.length,
      })
        .then((res) => {
          if (!cancelled) {
            const missingRequired = res.checks.filter((c) => c.required && !c.done);
            setApiResult({
              score: res.score,
              doneCount: res.doneCount,
              totalCount: res.totalCount,
              items: res.checks,
              missingRequired,
              hasUrgencyRisk: res.hasUrgencyRisk,
              urgencySignals: res.urgencySignals,
              urgencyMessage: res.urgencyMessage,
            });
          }
        })
        .catch(() => { if (!cancelled) setApiResult(null); })
        .finally(() => { if (!cancelled) setApiLoading(false); });
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [examType, exams.length, symptoms, images.length]);

  const completeness = apiResult
    ? { score: apiResult.score, doneCount: apiResult.doneCount, totalCount: apiResult.totalCount, items: apiResult.items, missingRequired: apiResult.missingRequired }
    : completenessLocal;
  const redFlags = apiResult
    ? {
        isUrgent: apiResult.hasUrgencyRisk,
        matchedSignals: apiResult.urgencySignals,
        guidance: apiResult.urgencyMessage ?? 'Sinais de urgência detectados. Considere buscar atendimento presencial.',
      }
    : redFlagsLocal;

  let currentStep = 1;
  if (examType) currentStep = 2;
  if (exams.length > 0) currentStep = 3;
  if (symptoms.trim().length > 0) currentStep = 4;

  const examValidation = validate(createExamSchema, { examType, exams, symptoms, images });
  const isFormValid = completeness.missingRequired.length === 0 && examValidation.success;
  const symptomsRef = useRef<TextInput>(null);

  useTriageEval({
    context: 'exam',
    step: exams.length > 0 ? 'type_selected' : 'entry',
    role: 'patient',
    requestType: 'exam',
    examType: examType,
    exams,
  });

  const addExam = () => {
    const exam = examInput.trim();
    if (exam && !exams.includes(exam)) {
      setExams([...exams, exam]);
      setExamInput('');
    }
  };

  const addQuickExam = (exam: string) => {
    if (!exams.includes(exam)) {
      setExams([...exams, exam]);
    }
  };

  const removeExam = (index: number) => {
    setExams(exams.filter((_, i) => i !== index));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para fotografar o pedido de exame.');
      return;
    }
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

  const submitExamRequest = async (payload: {
    examType: string;
    exams: string[];
    symptoms: string;
    images?: string[];
  }) => {
    setLoading(true);
    try {
      const result = await createExamRequest(payload);
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
      invalidateRequests();
      showToast({ message: 'Pedido de exame enviado! Acompanhe na aba Pedidos.', type: 'success' });
      router.replace('/(patient)/requests');
    } catch (error: unknown) {
      if (isDuplicateRequestError(error)) {
        Alert.alert(
          'Pedido em andamento',
          error.message,
          [
            { text: 'Ver meus pedidos', onPress: () => router.replace('/(patient)/requests'), style: 'default' },
            { text: 'OK', style: 'cancel' },
          ]
        );
      } else {
        showToast({ message: getApiErrorMessage(error), type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (completeness.missingRequired.length > 0) {
      showToast({ message: completeness.missingRequired.map((item) => item.label).join('. '), type: 'error' });
      symptomsRef.current?.focus();
      return;
    }

    const validation = validate(createExamSchema, { examType, exams, symptoms, images });
    if (!validation.success) {
      showToast({ message: validation.firstError ?? 'Informe os exames desejados e os sintomas.', type: 'error' });
      symptomsRef.current?.focus();
      return;
    }
    const payload = {
      examType: validation.data!.examType ?? 'laboratorial',
      exams: validation.data!.exams ?? [],
      symptoms: validation.data!.symptoms ?? '',
      images: (validation.data!.images?.length ?? 0) > 0 ? validation.data!.images : undefined,
    };

    if (redFlags.isUrgent) {
      Alert.alert(
        'Sinais de urgência detectados',
        `${redFlags.guidance}\n\nSinais identificados: ${redFlags.matchedSignals.join(', ')}`,
        [
          { text: 'Voltar', style: 'cancel' },
          { text: 'Continuar mesmo assim', style: 'destructive', onPress: () => { void submitExamRequest(payload); } },
        ]
      );
      return;
    }

    await submitExamRequest(payload);
  };

  return (
    <Screen scroll={false} padding={false} edges={['top', 'bottom']}>
      <View style={styles.flex1}>
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: listPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AppHeader title="Novo Exame" />
          <StepIndicator current={currentStep} total={4} labels={['Tipo', 'Exames', 'Sintomas', 'Revisão']} />

          {/* AI Completeness */}
          <View style={[styles.completenessCard, apiLoading && styles.completenessCardLoading]}>
            <View style={styles.completenessHeader}>
              <View style={styles.completenessIconWrap}>
                <Ionicons name="sparkles" size={16} color="#8B5CF6" />
              </View>
              <Text style={styles.completenessTitle}>Qualidade do envio</Text>
              {apiLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={styles.mlAuto} />
              )}
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${completeness.score}%`,
                    backgroundColor: completeness.score === 100 ? '#22C55E' : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.completenessScore}>{completeness.score}% pronto</Text>
            {completeness.missingRequired.map((item) => (
              <View key={item.id} style={styles.missingRow}>
                <Ionicons name="ellipse-outline" size={12} color={colors.textMuted} />
                <Text style={styles.missingText}>{item.label}</Text>
              </View>
            ))}
            {completeness.missingRequired.length === 0 && (
              <View style={styles.missingRow}>
                <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                <Text style={styles.readyText}>Pedido consistente para revisão</Text>
              </View>
            )}
          </View>

          {redFlags.isUrgent && (
            <View style={styles.redFlagCard}>
              <Ionicons name="warning-outline" size={18} color={colors.error} />
              <Text style={styles.redFlagText}>{redFlags.guidance}</Text>
            </View>
          )}

          {/* Exam Type */}
          <Text style={styles.sectionLabel}>Tipo de exame</Text>
          <View style={styles.typeRow}>
            {EXAM_TYPES.map(type => {
              const isSelected = examType === type.key;
              return (
                <AppCard
                  key={type.key}
                  selected={isSelected}
                  onPress={() => setExamType(type.key)}
                  style={styles.typeCard}
                >
                  <View style={[styles.typeIconWrap, { backgroundColor: type.accent + '14' }]}>
                    <Ionicons name={type.icon} size={24} color={isSelected ? type.accent : colors.textMuted} />
                  </View>
                  <Text style={[styles.typeName, isSelected && styles.typeNameSelected]} numberOfLines={1}>
                    {type.label}
                  </Text>
                  <Text style={styles.typeDesc} numberOfLines={2}>{type.desc}</Text>
                </AppCard>
              );
            })}
          </View>

          {/* Exams List */}
          <Text style={styles.sectionLabel}>Exames desejados</Text>
          <View style={styles.inputRow}>
            <AppInput
              placeholder="Ex: Hemograma completo"
              value={examInput}
              onChangeText={setExamInput}
              onSubmitEditing={addExam}
              returnKeyType="done"
              blurOnSubmit={false}
              autoCapitalize="sentences"
              autoCorrect={false}
              editable={!loading}
              containerStyle={styles.inputContainer}
            />
            <TouchableOpacity
              style={[styles.addButton, !examInput.trim() && styles.addButtonDisabled]}
              onPress={addExam}
              disabled={!examInput.trim()}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Quick Exam Chips */}
          {exams.length === 0 && (
            <View style={styles.quickSection}>
              <Text style={styles.quickLabel}>Sugestões rápidas:</Text>
              <View style={styles.quickChips}>
                {QUICK_EXAMS.map((exam) => (
                  <TouchableOpacity
                    key={exam}
                    style={styles.quickChip}
                    onPress={() => addQuickExam(exam)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
                    <Text style={styles.quickChipText}>{exam}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {exams.length > 0 && (
            <View style={styles.tags}>
              {exams.map((exam, index) => (
                <View key={`${exam}-${index}`} style={styles.tag}>
                  <Text style={styles.tagText}>{exam}</Text>
                  <TouchableOpacity onPress={() => removeExam(index)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Symptoms */}
          <Text style={styles.sectionLabel}>Sintomas</Text>
          <Text style={styles.fieldHint}>Descreva o que motivou o pedido de exame</Text>
          <TextInput
            ref={symptomsRef}
            style={[styles.textarea, !isFormValid && symptoms.trim().length === 0 && styles.inputError]}
            placeholder="Ex: Dor de cabeça frequente há 2 semanas..."
            placeholderTextColor={colors.textMuted}
            value={symptoms}
            onChangeText={setSymptoms}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect
            returnKeyType="default"
            editable={!loading}
            accessibilityLabel="Descreva seus sintomas"
            accessibilityHint="Campo obrigatório para descrever seus sintomas"
          />
          {!isFormValid && symptoms.trim().length === 0 && (
            <Text style={styles.inputErrorHint}>Descreva seus sintomas para continuar</Text>
          )}

          {/* Photo */}
          <Text style={styles.sectionLabel}>Foto do pedido (opcional)</Text>
          <Text style={styles.fieldHint}>
            Se você tem um pedido de exame ou laudo, envie a foto aqui.
          </Text>
          <View style={styles.photoRow}>
            <TouchableOpacity style={styles.photoButton} onPress={pickImage} activeOpacity={0.7}>
              <View style={styles.photoIconCircle}>
                <Ionicons name="camera" size={22} color={colors.primary} />
              </View>
              <Text style={styles.photoText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={pickFromGallery} activeOpacity={0.7}>
              <View style={styles.photoIconCircle}>
                <Ionicons name="image" size={22} color={colors.primary} />
              </View>
              <Text style={styles.photoText}>Galeria</Text>
            </TouchableOpacity>
          </View>
          {images.length > 0 && (
            <View style={styles.imagesRow}>
              {images.map((uri, i) => (
                <View key={i} style={styles.imgWrap}>
                  <CompatibleImage uri={uri && typeof uri === 'string' ? uri : undefined} style={styles.imgPreview} />
                  <TouchableOpacity
                    style={styles.imgRemove}
                    onPress={() => setImages(images.filter((_, j) => j !== i))}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <StickyCTA
          summaryTitle="Resumo"
          summaryValue={`${completeness.score}% pronto`}
          summaryHint={`${examType === 'imagem' ? 'pedido de imagem' : 'pedido laboratorial'}`}
          primary={{
            label: 'Enviar pedido',
            onPress: handleSubmit,
            loading,
            disabled: loading || !isFormValid,
          }}
        />
      </View>
    </Screen>
  );
}

function makeStyles(colors: DesignColors, narrow: boolean) {
  return StyleSheet.create({
    flex1: { flex: 1 },
    body: {
      flexGrow: 1,
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
    },

    /* Completeness Card */
    completenessCard: {
      marginTop: s.md,
      marginBottom: s.sm,
      padding: s.md,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    completenessCardLoading: { opacity: 0.9 },
    completenessHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
      marginBottom: s.sm,
    },
    completenessIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: '#8B5CF6' + '14',
      alignItems: 'center',
      justifyContent: 'center',
    },
    completenessTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    mlAuto: { marginLeft: 'auto' },
    progressBarBg: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      marginBottom: 6,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: 6,
      borderRadius: 3,
    },
    completenessScore: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    missingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    missingText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    readyText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#22C55E',
    },

    /* Red flags */
    redFlagCard: {
      marginTop: s.sm,
      marginBottom: s.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.errorLight,
      backgroundColor: colors.errorLight,
      padding: s.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s.sm,
    },
    redFlagText: { flex: 1, color: colors.error, fontSize: 12, lineHeight: 18 },

    /* Sections */
    sectionLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginTop: s.lg,
      marginBottom: s.sm,
    },
    fieldHint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: s.sm,
      lineHeight: 18,
    },

    /* Type Cards */
    typeRow: {
      flexDirection: narrow ? 'column' : 'row',
      gap: s.sm,
    },
    typeCard: {
      flex: narrow ? undefined : 1,
      alignItems: 'center',
      paddingVertical: s.md,
    },
    typeIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: s.sm,
    },
    typeName: {
      fontSize: ty.fontSize.sm,
      fontWeight: '700',
      color: colors.text,
    },
    typeNameSelected: {
      color: colors.primary,
    },
    typeDesc: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 2,
      lineHeight: 16,
    },

    /* Input Row */
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
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonDisabled: {
      opacity: 0.5,
    },

    /* Quick Chips */
    quickSection: {
      marginTop: s.sm,
    },
    quickLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 6,
    },
    quickChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    quickChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    quickChipText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '500',
    },

    /* Tags */
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: s.sm,
      gap: s.sm,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      gap: 6,
    },
    tagText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '500',
    },

    /* Textarea */
    textarea: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: s.md,
      fontSize: ty.fontSize.md,
      color: colors.text,
      minHeight: 100,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputError: {
      borderColor: colors.error,
      borderWidth: 1.5,
    },
    inputErrorHint: {
      marginTop: s.xs,
      fontSize: 12,
      color: colors.error,
      lineHeight: 16,
    },

    /* Photo */
    photoRow: {
      flexDirection: 'row',
      gap: s.md,
    },
    photoButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: s.md,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      gap: s.xs,
    },
    photoIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    imagesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: s.sm,
      gap: s.sm,
    },
    imgWrap: {
      position: 'relative',
    },
    imgPreview: {
      width: 76,
      height: 76,
      borderRadius: 12,
    },
    imgRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: colors.surface,
      borderRadius: 10,
    },
  });
}
