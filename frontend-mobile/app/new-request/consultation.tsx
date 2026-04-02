import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { createConsultationRequest } from '../../lib/api';
import { showToast } from '../../components/ui/Toast';
import { useInvalidateRequests } from '../../lib/hooks/useRequestsQuery';
import { getApiErrorMessage } from '../../lib/api-client';
import { validate } from '../../lib/validation';
import { createConsultationSchema } from '../../lib/validation/schemas';
import { useStickyCtaScrollPadding } from '../../lib/ui/responsive';
import { Screen } from '../../components/ui/Screen';
import { AppHeader, AppCard, StepIndicator, StickyCTA } from '../../components/ui';
import { useTriageEval } from '../../hooks/useTriageEval';
import { useSymptomVoiceInput } from '../../hooks/useSymptomVoiceInput';
import { detectRedFlags, evaluateConsultationCompleteness } from '../../lib/domain/assistantIntelligence';
import { evaluateAssistantCompleteness } from '../../lib/api';

const s = theme.spacing;
const _r = theme.borderRadius;
const ty = theme.typography;

const CONSULTATION_TYPES = [
  {
    key: 'psicologo' as const,
    label: 'Psicólogo',
    desc: 'Dúvidas e orientações de saúde mental',
    icon: 'heart-outline' as const,
    accent: '#8B5CF6',
  },
  {
    key: 'medico_clinico' as const,
    label: 'Médico Clínico',
    desc: 'Orientações médicas e dúvidas de saúde',
    icon: 'medkit-outline' as const,
    accent: '#0EA5E9',
  },
];

const URGENCY_OPTIONS = [
  { key: 'rotina' as const, label: 'Rotina', desc: 'Sem pressa, dúvida geral', icon: 'time-outline' as const },
  { key: 'urgente' as const, label: 'Urgente', desc: 'Preciso de atendimento rápido', icon: 'flash-outline' as const },
];

export default function ConsultationScreen() {
  const router = useRouter();
  const invalidateRequests = useInvalidateRequests();
  const { width } = useWindowDimensions();
  const narrow = width < 400;
  const [consultationType, setConsultationType] = useState<'psicologo' | 'medico_clinico'>('psicologo');
  const [symptoms, setSymptoms] = useState('');
  const [urgency, setUrgency] = useState<'rotina' | 'urgente'>('rotina');
  const [loading, setLoading] = useState(false);
  const voice = useSymptomVoiceInput();
  const { colors } = useAppTheme({ role: 'patient' });
  const styles = useMemo(() => makeStyles(colors, narrow), [colors, narrow]);
  const listPadding = useStickyCtaScrollPadding();
  // Teleconsulta sem limite de tempo — usar 30min como padrão para completude
  const defaultDuration = 30;
  const completenessLocal = evaluateConsultationCompleteness({
    consultationType,
    durationMinutes: defaultDuration,
    symptoms,
  });
  const redFlagsLocal = detectRedFlags(symptoms);
  const [apiLoading, setApiLoading] = useState(false);
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
        flow: 'consultation',
        consultationType,
        durationMinutes: defaultDuration,
        symptoms,
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
  }, [consultationType, symptoms]);

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

  const [userPickedType, setUserPickedType] = useState(false);
  let currentStep = 1;
  if (userPickedType) currentStep = 2;
  if (userPickedType && symptoms.trim().length > 0) currentStep = 3;

  const consultationValidation = validate(createConsultationSchema, {
    consultationType,
    durationMinutes: defaultDuration,
    symptoms,
  });
  const isFormValid = completeness.missingRequired.length === 0 && consultationValidation.success;
  const symptomsRef = useRef<TextInput>(null);

  const handleMicToggle = async () => {
    if (voice.isRecording) {
      const text = await voice.stopAndTranscribe(symptoms);
      if (text) {
        setSymptoms((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
        showToast({ message: 'Sintomas transcritos com sucesso!', type: 'success' });
      } else if (voice.error) {
        showToast({ message: voice.error, type: 'error' });
      }
    } else {
      await voice.startRecording();
    }
  };

  useTriageEval({
    context: 'consultation',
    step: symptoms.trim().length > 0 ? 'symptoms_entered' : 'entry',
    role: 'patient',
    requestType: 'consultation',
    symptoms: symptoms || undefined,
  });

  const submitConsultation = async (payload: {
    consultationType: 'psicologo' | 'medico_clinico';
    durationMinutes: number;
    symptoms: string;
  }) => {
    setLoading(true);
    try {
      await createConsultationRequest(payload);
      invalidateRequests();
      showToast({ message: 'Consulta solicitada! Aguarde um profissional aceitar.', type: 'success' });
      router.replace('/(patient)/requests');
    } catch (error: unknown) {
      showToast({ message: getApiErrorMessage(error), type: 'error' });
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

    const validation = validate(createConsultationSchema, {
      consultationType,
      durationMinutes: defaultDuration,
      symptoms,
    });
    if (!validation.success) {
      showToast({ message: validation.firstError ?? 'Preencha todos os campos.', type: 'error' });
      symptomsRef.current?.focus();
      return;
    }
    const payload = validation.data!;

    if (redFlags.isUrgent) {
      Alert.alert(
        'Sinais de urgência detectados',
        `${redFlags.guidance}\n\nSinais identificados: ${redFlags.matchedSignals.join(', ')}`,
        [
          { text: 'Voltar', style: 'cancel' },
          { text: 'Continuar mesmo assim', style: 'destructive', onPress: () => { void submitConsultation(payload); } },
        ]
      );
      return;
    }

    await submitConsultation(payload);
  };

  return (
    <Screen scroll={false} edges={['top', 'bottom']} padding={false}>
      <View style={styles.flex1}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: listPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AppHeader title="Teleconsulta" />
          <StepIndicator
            current={currentStep}
            total={3}
            labels={['Profissional', 'Sintomas', 'Revisão']}
            showConnectorLines={false}
          />

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
                <Text style={styles.readyText}>Pronto para enviar para triagem</Text>
              </View>
            )}
          </View>

          {redFlags.isUrgent && (
            <View style={styles.redFlagCard}>
              <Ionicons name="warning-outline" size={18} color={colors.error} />
              <Text style={styles.redFlagText}>{redFlags.guidance}</Text>
            </View>
          )}

          {/* Professional Type */}
          <Text style={styles.sectionLabel}>Tipo de profissional</Text>
          <View style={styles.typeRow}>
            {CONSULTATION_TYPES.map(type => {
              const isSelected = consultationType === type.key;
              return (
                <AppCard
                  key={type.key}
                  selected={isSelected}
                  onPress={() => { setConsultationType(type.key); setUserPickedType(true); }}
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

          {/* Urgency */}
          <Text style={styles.sectionLabel}>Urgência</Text>
          <View style={styles.urgencyRow}>
            {URGENCY_OPTIONS.map(opt => {
              const isSelected = urgency === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.urgencyChip, isSelected && styles.urgencyChipSelected]}
                  onPress={() => setUrgency(opt.key)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Ionicons
                    name={opt.icon}
                    size={16}
                    color={isSelected ? colors.primary : colors.textMuted}
                    importantForAccessibility="no"
                  />
                  <Text style={[styles.urgencyLabel, isSelected && styles.urgencyLabelSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Symptoms */}
          <View style={styles.symptomLabelRow}>
            <Text style={[styles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>Descreva seus sintomas</Text>
            <TouchableOpacity
              style={[styles.micBtn, voice.isRecording && styles.micBtnRecording]}
              onPress={handleMicToggle}
              disabled={voice.isTranscribing || loading}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={voice.isRecording ? 'Parar gravação' : 'Gravar sintomas por voz'}
            >
              {voice.isTranscribing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons
                    name={voice.isRecording ? 'stop' : 'mic'}
                    size={16}
                    color={voice.isRecording ? '#EF4444' : colors.primary}
                  />
                  <Text style={[styles.micBtnText, voice.isRecording && styles.micBtnTextRec]}>
                    {voice.isRecording ? `${voice.durationSeconds}s` : 'Falar'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.fieldHint}>
            {voice.isRecording
              ? 'Fale seus sintomas... toque em parar quando terminar.'
              : voice.isTranscribing
                ? 'Processando sua fala...'
                : 'Escreva ou use o microfone para descrever o que sente.'}
          </Text>
          {voice.error && (
            <Text style={styles.voiceError}>{voice.error}</Text>
          )}
          <TextInput
            ref={symptomsRef}
            style={[
              styles.textArea,
              symptoms.trim().length > 0 && symptoms.trim().length < 10 && styles.inputWarning,
            ]}
            placeholder="Ex: Estou com ansiedade e dificuldade para dormir..."
            placeholderTextColor={colors.textMuted}
            value={symptoms}
            onChangeText={setSymptoms}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect
            returnKeyType="default"
            editable={!loading && !voice.isTranscribing}
            accessibilityLabel="Descreva seus sintomas"
            accessibilityHint="Campo obrigatório para descrever seus sintomas ou dúvida"
          />
        </ScrollView>

        <StickyCTA
          summaryTitle="Resumo"
          summaryValue={`${completeness.score}% pronto`}
          summaryHint="Teleconsulta sem limite de tempo"
          primary={{
            label: 'Agendar consulta',
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
    content: {
      flexGrow: 1,
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
    },

    /* Completeness Card */
    completenessCard: {
      marginTop: s.md,
      marginBottom: s.md,
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

    /* Section */
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
      minWidth: narrow ? undefined : 140,
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
      fontSize: ty.fontSize.md,
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

    /* Urgency */
    urgencyRow: {
      flexDirection: 'row',
      gap: s.sm,
    },
    urgencyChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    urgencyChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    urgencyLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    urgencyLabelSelected: {
      color: colors.primary,
    },

    /* Symptom label + mic */
    symptomLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: s.lg,
      marginBottom: s.sm,
    },
    micBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    micBtnRecording: {
      backgroundColor: '#FEE2E2',
      borderColor: '#EF444440',
    },
    micBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    micBtnTextRec: {
      color: '#EF4444',
    },
    voiceError: {
      fontSize: 12,
      color: colors.error,
      marginBottom: s.xs,
    },

    /* Textarea */
    textArea: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: s.md,
      paddingTop: s.md,
      paddingBottom: s.md,
      fontSize: ty.fontSize.md,
      lineHeight: 22,
      color: colors.text,
      minHeight: 120,
      marginBottom: s.md,
    },
    inputWarning: {
      borderColor: colors.warning + 'CC',
      borderWidth: 1.5,
    },
  });
}
