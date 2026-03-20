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
import { detectRedFlags, evaluateConsultationCompleteness } from '../../lib/domain/assistantIntelligence';
import { evaluateAssistantCompleteness } from '../../lib/api';

const s = theme.spacing;
const r = theme.borderRadius;
const t = theme.typography;

const PROFESSIONAL_TYPE_DESC =
  'O profissional está disponível para dúvidas e orientações pontuais. Não é adequado para acompanhamento contínuo.';

const CONSULTATION_DURATION_MINUTES = 15;

const CONSULTATION_TYPES = [
  { key: 'psicologo' as const, label: 'Psicólogo', desc: PROFESSIONAL_TYPE_DESC },
  { key: 'medico_clinico' as const, label: 'Médico Clínico', desc: PROFESSIONAL_TYPE_DESC },
];

const NARROW_BREAKPOINT = 400;

export default function ConsultationScreen() {
  const router = useRouter();
  const invalidateRequests = useInvalidateRequests();
  const { width } = useWindowDimensions();
  const oneColumn = width < NARROW_BREAKPOINT;
  const [consultationType, setConsultationType] = useState<'psicologo' | 'medico_clinico'>('psicologo');
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const { colors } = useAppTheme({ role: 'patient' });
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const listPadding = useStickyCtaScrollPadding();
  const completenessLocal = evaluateConsultationCompleteness({
    consultationType,
    durationMinutes: CONSULTATION_DURATION_MINUTES,
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
        durationMinutes: CONSULTATION_DURATION_MINUTES,
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
    durationMinutes: CONSULTATION_DURATION_MINUTES,
    symptoms,
  });
  const isFormValid = completeness.missingRequired.length === 0 && consultationValidation.success;
  const symptomsRef = useRef<TextInput>(null);

  /** Dra. Renoveja: dicas (descreva sintomas, mais detalhes). */
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
      durationMinutes: CONSULTATION_DURATION_MINUTES,
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
      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: listPadding }]} showsVerticalScrollIndicator={false}>
        <AppHeader title="Consulta Breve" />
        <StepIndicator current={currentStep} total={3} labels={['Profissional', 'Sintomas', 'Revisão']} showConnectorLines={false} />
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
            <Text style={styles.assistantGood}>Perfeito. Vamos enviar para triagem médica.</Text>
          ) : null}
        </AppCard>
        {redFlags.isUrgent ? (
          <View style={styles.redFlagCard}>
            <Ionicons name="warning-outline" size={18} color={colors.error} />
            <Text style={styles.redFlagText}>{redFlags.guidance}</Text>
          </View>
        ) : null}

        {/* Tipo: Psicólogo ou Médico Clínico */}
        <Text style={styles.overline}>TIPO DE PROFISSIONAL</Text>
        {currentStep === 1 && (
          <Text style={styles.stepHint}>Passo 1 — Escolha com quem você quer falar. Toque em Psicólogo ou Médico Clínico.</Text>
        )}
        <View style={[styles.typeRow, oneColumn && styles.typeRowOneCol]}>
          {CONSULTATION_TYPES.map(type => (
            <AppCard
              key={type.key}
              selected={consultationType === type.key}
              onPress={() => { setConsultationType(type.key); setUserPickedType(true); }}
              style={StyleSheet.flatten(oneColumn ? [styles.typeCard, styles.typeCardFull] : styles.typeCard)}
            >
              <Text style={[styles.typeName, consultationType === type.key && styles.typeNameSelected]} numberOfLines={1}>
                {type.label}
              </Text>
              <Text style={styles.typeDesc} numberOfLines={4} ellipsizeMode="tail">{type.desc}</Text>
            </AppCard>
          ))}
        </View>

        <Text style={styles.overline}>DURAÇÃO</Text>
        <Text style={styles.minutesHint}>
          A consulta terá duração de {CONSULTATION_DURATION_MINUTES} minutos. A chamada encerra automaticamente ao atingir o tempo.
        </Text>

        {/* Sintomas */}
        <Text style={styles.overline}>DESCREVA SEUS SINTOMAS / DÚVIDA</Text>
        {currentStep === 2 && (
          <Text style={styles.stepHint}>Passo 2 — Escreva o que você está sentindo ou a dúvida que tem. Isso ajuda o profissional a te atender melhor.</Text>
        )}
        <TextInput
          ref={symptomsRef}
          style={[
            styles.textArea,
            symptoms.trim().length > 0 && symptoms.trim().length < 10 && [styles.inputError, { borderColor: colors.warning + 'CC' }],
          ]}
          placeholder="Descreva sintomas, desde quando e sua dúvida"
          placeholderTextColor={colors.textMuted}
          value={symptoms}
          onChangeText={setSymptoms}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

      </ScrollView>
      <StickyCTA
        summaryTitle="Resumo"
        summaryValue={`${completeness.score}% pronto`}
        summaryHint={`${CONSULTATION_DURATION_MINUTES} min de consulta`}
        primary={{
          label: 'Solicitar consulta',
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
    content: {
      flexGrow: 1,
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
      paddingBottom: s.xl,
      overflow: 'hidden',
    },
    assistantCard: {
      marginTop: s.md,
      marginBottom: s.lg,
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
    overline: {
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginBottom: s.sm,
    },
    stepHint: {
      fontSize: 13,
      color: colors.text,
      marginBottom: s.sm,
      lineHeight: 20,
      alignSelf: 'stretch',
    },
    typeRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: s.lg,
    },
    typeRowOneCol: {
      flexDirection: 'column',
    },
    typeCard: {
      flex: 1,
      minWidth: 140,
    },
    typeCardFull: {
      width: '100%',
      minWidth: undefined,
    },
    typeName: {
      fontSize: t.fontSize.md,
      fontWeight: '700',
      color: colors.text,
    },
    typeNameSelected: {
      color: colors.primary,
    },
    typePricePerMin: {
      fontSize: t.fontSize.lg,
      lineHeight: 24,
      fontWeight: '700',
      color: colors.text,
      marginTop: s.xs,
    },
    typeDesc: {
      fontSize: t.fontSize.xs,
      color: colors.textMuted,
      marginTop: s.xs,
      lineHeight: 16,
      paddingBottom: 2,
    },
    minutesHint: {
      fontSize: t.fontSize.sm,
      color: colors.textSecondary,
      marginBottom: s.sm,
      lineHeight: 18,
      alignSelf: 'stretch',
    },
    minutesStepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.lg,
      marginBottom: s.lg,
      alignSelf: 'stretch',
    },
    stepperBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primarySoft,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperBtnDisabled: {
      opacity: 0.5,
      borderColor: colors.border,
    },
    minutesStepperValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      minWidth: 72,
      textAlign: 'center',
      lineHeight: 48,
    },
    textArea: {
      backgroundColor: colors.surface,
      borderRadius: r.md,
      borderWidth: 2,
      borderColor: colors.border,
      paddingHorizontal: s.md,
      paddingTop: s.md,
      paddingBottom: s.md,
      fontSize: t.fontSize.md,
      lineHeight: 22,
      color: colors.text,
      minHeight: 120,
      marginBottom: s.lg,
    },
    inputError: {
      borderWidth: 2,
    },
    totalCard: {
      marginBottom: s.lg,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: s.xs,
    },
    totalLabel: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400',
      color: colors.textSecondary,
      flex: 1,
    },
    totalValue: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '700',
      color: colors.primary,
    },
    discountValue: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '600',
      color: colors.success,
    },
    freeLabel: {
      fontSize: t.fontSize.sm,
      color: colors.success,
      fontWeight: '600',
      marginTop: s.xs,
      textAlign: 'center',
    },
    bankCard: {
      marginBottom: s.md,
      backgroundColor: colors.successLight,
      borderColor: colors.success,
      borderWidth: 1,
    },
    bankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
    },
    bankText: {
      fontSize: 14,
      color: colors.success,
      flex: 1,
      lineHeight: 18,
    },
    bankBold: {
      fontWeight: '700',
    },
  });
}
