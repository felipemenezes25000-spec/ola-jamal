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
import { EXAM_TYPE_PRICES } from '../../lib/config/pricing';
import { formatBRL } from '../../lib/utils/format';
import { getApiErrorMessage } from '../../lib/api-client';
import { isDuplicateRequestError } from '../../lib/hooks/useCreateRequest';
import { validate } from '../../lib/validation';
import { createExamSchema } from '../../lib/validation/schemas';
import { useStickyCtaScrollPadding, useResponsive } from '../../lib/ui/responsive';
import { Screen } from '../../components/ui/Screen';
import { AppHeader, AppCard, AppInput, StepIndicator, StickyCTA } from '../../components/ui';
import { CompatibleImage } from '../../components/CompatibleImage';
import { useTriageEval } from '../../hooks/useTriageEval';
import { detectRedFlags, evaluateExamCompleteness } from '../../lib/domain/assistantIntelligence';

const s = theme.spacing;
const r = theme.borderRadius;
const ty = theme.typography;

const EXAM_TYPES = [
  { key: 'laboratorial' as const, label: 'Laboratorial', desc: 'Peça exames e receba em poucos instantes.', icon: 'flask' as const },
  { key: 'imagem' as const, label: 'Imagem', desc: 'Raio-X, ultrassom, tomografia e outros.', icon: 'scan' as const, priceSuffix: 'POR PEDIDO' },
];

const NARROW_BREAKPOINT = 360;

export default function NewExam() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prefillExams?: string }>();
  const invalidateRequests = useInvalidateRequests();
  const { width } = useWindowDimensions();
  const oneColumn = width < NARROW_BREAKPOINT;
  const [examType, setExamType] = useState('laboratorial');
  const [exams, setExams] = useState<string[]>([]);
  const [examInput, setExamInput] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { colors } = useAppTheme();
  const { rs, isCompact } = useResponsive();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const listPadding = useStickyCtaScrollPadding();
  const completenessLocal = evaluateExamCompleteness({
    examType,
    examsCount: exams.length,
    symptoms,
    imagesCount: images.length,
  });
  const redFlagsLocal = detectRedFlags(symptoms);
  const [apiLoading, setApiLoading] = useState(false);
  /** Prefill de exames vindos da consulta (ex.: médico clicou em "Criar Pedido de Exame Baseado na Consulta") */
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

  const selectedPrice = formatBRL(EXAM_TYPE_PRICES[examType as 'laboratorial' | 'imagem']);
  const symptomsRef = useRef<TextInput>(null);

  /** Dra. Renoveja: dicas por etapa (tipo imagem, exames). */
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

    const validation = validate(createExamSchema, {
      examType,
      exams,
      symptoms,
      images,
    });
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
      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: listPadding }]} showsVerticalScrollIndicator={false}>
        <AppHeader title="Novo Exame" />
        <StepIndicator current={currentStep} total={4} labels={['Tipo', 'Exames', 'Sintomas', 'Revisão']} />
        <AppCard style={[styles.assistantCard, apiLoading && styles.assistantCardLoading]}>
          <View style={styles.assistantHeader}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            <Text style={styles.assistantTitle}>Dra. Renoveja: qualidade do envio</Text>
            {apiLoading && (
              <ActivityIndicator size="small" color={colors.primary} style={styles.assistantLoading} />
            )}
          </View>
          <Text style={styles.assistantProgress}>Seu pedido está {completeness.score}% pronto</Text>
          {completeness.missingRequired.map((item) => (
            <Text key={item.id} style={styles.assistantMissing}>• {item.label}</Text>
          ))}
          {completeness.missingRequired.length === 0 ? (
            <Text style={styles.assistantGood}>Perfeito. Pedido consistente para revisão médica.</Text>
          ) : null}
        </AppCard>
        {redFlags.isUrgent ? (
          <View style={styles.redFlagCard}>
            <Ionicons name="warning-outline" size={18} color={colors.error} />
            <Text style={styles.redFlagText}>{redFlags.guidance}</Text>
          </View>
        ) : null}
        {/* Exam Type */}
        <Text style={styles.overline}>TIPO DE EXAME</Text>
        {currentStep === 1 && (
          <Text style={styles.stepHint}>Passo 1 — Selecione o tipo de exame tocando em um dos cards abaixo (laboratorial ou imagem).</Text>
        )}
        <View style={[styles.typeRow, { gap: rs(12) }, oneColumn && styles.typeRowOneCol]}>
          {EXAM_TYPES.map(type => {
            const price = EXAM_TYPE_PRICES[type.key];
            return (
              <AppCard
                key={type.key}
                selected={examType === type.key}
                onPress={() => setExamType(type.key)}
                style={StyleSheet.flatten(oneColumn ? [styles.typeCard, styles.typeCardFull] : styles.typeCard)}
              >
                <Ionicons
                  name={type.icon}
                  size={28}
                  color={examType === type.key ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.typeName, examType === type.key && styles.typeNameSelected]} numberOfLines={1}>
                  {type.label}
                </Text>
                <Text style={styles.typePrice} numberOfLines={1}>{formatBRL(price)}</Text>
                {'priceSuffix' in type && type.priceSuffix && (
                  <Text style={styles.typePriceSuffix} numberOfLines={1}>{type.priceSuffix}</Text>
                )}
                <Text style={styles.typeDesc} numberOfLines={3}>{type.desc}</Text>
              </AppCard>
            );
          })}
        </View>

        {/* Exams List */}
        <Text style={styles.overline}>EXAMES DESEJADOS</Text>
        {currentStep === 2 && (
          <Text style={styles.stepHint}>Passo 2 — Digite o nome do exame e toque no botão + para adicionar. Faça isso para cada exame que você precisa.</Text>
        )}
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
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
        {exams.length > 0 && (
          <View style={styles.tags}>
            {exams.map((exam, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{exam}</Text>
                <TouchableOpacity onPress={() => removeExam(index)}>
                  <Ionicons name="close" size={16} color={colors.accent} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Symptoms */}
        <Text style={styles.overline}>SINTOMAS (OBRIGATÓRIO)</Text>
        <TextInput
          ref={symptomsRef}
          style={[styles.textarea, !isFormValid && symptoms.trim().length === 0 && styles.inputError]}
          placeholder="Descreva seus sintomas"
          placeholderTextColor={colors.textMuted}
          value={symptoms}
          onChangeText={setSymptoms}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        {!isFormValid && symptoms.trim().length === 0 && (
          <Text style={styles.inputErrorHint}>Descreva seus sintomas para continuar</Text>
        )}

        {/* Photo */}
        <Text style={styles.overline}>FOTO DO PEDIDO (SE TIVER)</Text>
        {currentStep === 3 && (
          <Text style={styles.stepHint}>Passo 3 — Se você tiver um pedido de exame ou laudo, envie a foto aqui. Toque em Câmera ou Galeria. Se não tiver, pode pular esta parte.</Text>
        )}
        <Text style={styles.photoHint}>
          Envie apenas fotos do documento (pedido de exame ou laudo). Fotos de pessoas, animais ou outros objetos serão rejeitadas.
        </Text>
        <View style={styles.photoRow}>
          <TouchableOpacity style={[styles.photoButton, isCompact && { minHeight: rs(90) }]} onPress={pickImage}>
            <Ionicons name="camera" size={28} color={colors.primary} />
            <Text style={styles.photoText}>Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.photoButton, isCompact && { minHeight: rs(90) }]} onPress={pickFromGallery}>
            <Ionicons name="image" size={28} color={colors.primary} />
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

        {/* Price Info */}
        <View style={styles.priceBox}>
          <Ionicons name="pricetag" size={18} color={colors.secondary} />
          <Text style={styles.priceText}>
            Valor do pedido de exame:{' '}
            <Text style={styles.priceValue}>{selectedPrice}</Text>
            {examType === 'imagem' && (
              <Text style={styles.priceSuffix}> (por pedido)</Text>
            )}
          </Text>
        </View>
      </ScrollView>
      <StickyCTA
        summaryTitle="Total"
        summaryValue={selectedPrice}
        summaryHint={`${completeness.score}% pronto • ${examType === 'imagem' ? 'cobrança por pedido de imagem' : 'pedido laboratorial'}`}
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

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    body: {
      flexGrow: 1,
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
    },
    overline: {
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginTop: s.lg,
      marginBottom: s.sm,
    },
    assistantCard: {
      marginTop: s.md,
      borderWidth: 1,
      borderColor: colors.primarySoft,
      backgroundColor: colors.primarySoft + '66',
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    assistantCardLoading: { opacity: 0.95 },
    assistantLoading: { marginLeft: 'auto' },
    assistantHeader: { flexDirection: 'row', alignItems: 'center', gap: s.xs },
    assistantTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
    assistantProgress: { marginTop: 6, fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.text },
    assistantMissing: { marginTop: 6, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
    assistantGood: { marginTop: 8, fontSize: 12, fontWeight: '700', color: colors.success },
    redFlagCard: {
      marginTop: s.sm,
      marginBottom: s.sm,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.errorLight,
      backgroundColor: colors.errorLight,
      padding: s.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s.sm,
    },
    redFlagText: { flex: 1, color: colors.error, fontSize: 12, lineHeight: 18 },
    stepHint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: s.sm,
      lineHeight: 20,
    },
    typeRow: {
      flexDirection: 'row',
      gap: 12,
    },
    typeRowOneCol: {
      flexDirection: 'column',
    },
    typeCard: {
      flex: 1,
      alignItems: 'center',
    },
    typeCardFull: {
      width: '100%',
    },
    typeName: {
      fontSize: ty.fontSize.sm,
      fontWeight: '600',
      color: colors.text,
      marginTop: s.sm,
    },
    typeNameSelected: {
      color: colors.primary,
    },
    typePrice: {
      fontSize: ty.fontSize.lg,
      fontWeight: '700',
      color: colors.text,
      marginTop: s.xs,
    },
    typePriceSuffix: {
      fontSize: ty.fontSize.xs,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    typeDesc: {
      fontSize: ty.fontSize.xs,
      color: colors.textMuted,
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
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
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
      backgroundColor: colors.accentSoft,
      paddingHorizontal: s.md,
      paddingVertical: s.xs,
      borderRadius: r.pill,
      gap: s.xs,
    },
    tagText: {
      fontSize: 13,
      color: colors.accent,
      fontWeight: '500',
    },
    textarea: {
      backgroundColor: colors.surface,
      borderRadius: r.md,
      padding: s.md,
      fontSize: ty.fontSize.md,
      color: colors.text,
      minHeight: 100,
      borderWidth: 1,
      borderColor: colors.border,
      ...theme.shadows.card,
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
    photoHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: s.sm,
    },
    photoRow: {
      flexDirection: 'row',
      gap: s.md,
    },
    photoButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingVertical: s.lg,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      gap: s.xs,
      ...theme.shadows.sm,
    },
    photoText: {
      fontSize: 13,
      color: colors.primary,
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
      backgroundColor: colors.surface,
      borderRadius: 10,
    },
    priceBox: {
      flexDirection: 'row',
      backgroundColor: colors.successLight,
      marginTop: s.lg,
      padding: s.md,
      borderRadius: r.lg,
      gap: s.sm,
      alignItems: 'center',
    },
    priceText: {
      fontSize: ty.fontSize.sm,
      color: colors.text,
    },
    priceValue: {
      fontWeight: '700',
      color: colors.secondary,
    },
    priceSuffix: {
      fontSize: ty.fontSize.xs,
      color: colors.textMuted,
    },
  });
}
