import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';
import { createConsultationRequest, getTimeBankBalance } from '../../lib/api';
import { CONSULTATION_PRICE_PER_MINUTE } from '../../lib/config/pricing';
import { formatBRL } from '../../lib/utils/format';
import { getApiErrorMessage } from '../../lib/api-client';
import { validate } from '../../lib/validation';
import { createConsultationSchema, CONSULTATION_MIN_MINUTES, CONSULTATION_MAX_MINUTES } from '../../lib/validation/schemas';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Screen } from '../../components/ui/Screen';
import { AppHeader, AppCard, StepIndicator, StickyCTA } from '../../components/ui';
import { useTriageEval } from '../../hooks/useTriageEval';
import { detectRedFlags, evaluateConsultationCompleteness } from '../../lib/domain/assistantIntelligence';
import { evaluateAssistantCompleteness } from '../../lib/api';

const c = theme.colors;
const s = theme.spacing;
const r = theme.borderRadius;
const t = theme.typography;

const SALDO_DESC =
  'Saldo em banco de horas. O profissional está disponível para dúvidas e orientações pontuais. Não para acompanhamento.';

const CONSULTATION_TYPES = [
  {
    key: 'psicologo' as const,
    label: 'Psicólogo',
    pricePerMin: CONSULTATION_PRICE_PER_MINUTE.psicologo,
    desc: SALDO_DESC,
  },
  {
    key: 'medico_clinico' as const,
    label: 'Médico Clínico',
    pricePerMin: CONSULTATION_PRICE_PER_MINUTE.medico_clinico,
    desc: SALDO_DESC,
  },
];

const NARROW_BREAKPOINT = 400;

export default function ConsultationScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const oneColumn = width < NARROW_BREAKPOINT;
  const [consultationType, setConsultationType] = useState<'psicologo' | 'medico_clinico'>('psicologo');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const addMinutes = () => setDurationMinutes((m) => Math.min(CONSULTATION_MAX_MINUTES, m + 1));
  const removeMinutes = () => setDurationMinutes((m) => Math.max(CONSULTATION_MIN_MINUTES, m - 1));
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [bankMinutes, setBankMinutes] = useState<number>(0);
  const [loadingBank, setLoadingBank] = useState(false);
  const listPadding = useListBottomPadding();
  const completenessLocal = evaluateConsultationCompleteness({
    consultationType,
    durationMinutes,
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
    setApiLoading(true);
    evaluateAssistantCompleteness({
      flow: 'consultation',
      consultationType,
      durationMinutes,
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
    return () => { cancelled = true; };
  }, [consultationType, durationMinutes, symptoms]);

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
  if (consultationType) currentStep = 2;
  if (durationMinutes >= CONSULTATION_MIN_MINUTES) currentStep = 3;
  if (symptoms.trim().length > 0) currentStep = 4;

  useEffect(() => {
    let cancelled = false;
    setLoadingBank(true);
    getTimeBankBalance(consultationType)
      .then(res => { if (!cancelled) setBankMinutes(res.balanceMinutes); })
      .catch(() => { if (!cancelled) setBankMinutes(0); })
      .finally(() => { if (!cancelled) setLoadingBank(false); });
    return () => { cancelled = true; };
  }, [consultationType]);

  /** Dra. Renoveja: dicas (descreva sintomas, mais detalhes). */
  useTriageEval({
    context: 'consultation',
    step: symptoms.trim().length > 0 ? 'symptoms_entered' : 'entry',
    role: 'patient',
    requestType: 'consultation',
    symptoms: symptoms || undefined,
  });

  const pricePerMin = CONSULTATION_PRICE_PER_MINUTE[consultationType];
  const { freeMinutes, paidMinutes, totalPrice } = useMemo(() => {
    const free = Math.min(bankMinutes, durationMinutes);
    const paid = durationMinutes - free;
    const total = Math.round(pricePerMin * paid * 100) / 100;
    return { freeMinutes: free, paidMinutes: paid, totalPrice: total };
  }, [pricePerMin, durationMinutes, bankMinutes]);

  const submitConsultation = async (payload: {
    consultationType: 'psicologo' | 'medico_clinico';
    durationMinutes: number;
    symptoms: string;
  }) => {
    setLoading(true);
    try {
      const result = await createConsultationRequest(payload);
      if (result.payment) {
        router.replace(`/payment/${result.payment.id}`);
      } else {
        Alert.alert('Sucesso', 'Consulta solicitada! Aguarde um profissional aceitar.', [
          { text: 'OK', onPress: () => router.replace('/(patient)/requests') },
        ]);
      }
    } catch (error: unknown) {
      Alert.alert('Erro', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (completeness.missingRequired.length > 0) {
      Alert.alert(
        'Faltam itens para enviar',
        completeness.missingRequired.map((item) => `• ${item.label}`).join('\n')
      );
      return;
    }

    const validation = validate(createConsultationSchema, {
      consultationType,
      durationMinutes,
      symptoms,
    });
    if (!validation.success) {
      Alert.alert('Atenção', validation.firstError ?? 'Preencha todos os campos.');
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
    <Screen scroll={false} edges={['bottom']} padding={false}>
      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: listPadding + 150 }]} showsVerticalScrollIndicator={false}>
        <AppHeader title="Consulta Breve" />
        <StepIndicator current={currentStep} total={4} labels={['Profissional', 'Minutos', 'Sintomas', 'Revisão']} />
        <AppCard style={[styles.assistantCard, apiLoading && styles.assistantCardLoading]}>
          <View style={styles.assistantHeader}>
            <Ionicons name="sparkles-outline" size={18} color={c.primary.main} />
            <Text style={styles.assistantTitle}>Dra. Renoveja: checklist de envio</Text>
            {apiLoading && (
              <ActivityIndicator size="small" color={c.primary.main} style={styles.assistantLoading} />
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
            <Ionicons name="warning-outline" size={18} color="#DC2626" />
            <Text style={styles.redFlagText}>{redFlags.guidance}</Text>
          </View>
        ) : null}
        {/* Banner */}
        <AppCard style={styles.banner}>
          <View style={styles.iconCircle}>
            <Ionicons name="videocam" size={28} color={c.primary.main} />
          </View>
          <Text style={styles.bannerTitle}>Consulta Breve - Renoveja+</Text>
          <Text style={styles.bannerDesc}>
            Plantão de dúvidas em telemedicina para sanar dúvidas pontuais!
          </Text>
        </AppCard>

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
              onPress={() => setConsultationType(type.key)}
              style={StyleSheet.flatten(oneColumn ? [styles.typeCard, styles.typeCardFull] : styles.typeCard)}
            >
              <Text style={[styles.typeName, consultationType === type.key && styles.typeNameSelected]} numberOfLines={1}>
                {type.label}
              </Text>
              <Text style={styles.typePricePerMin} numberOfLines={1}>{formatBRL(type.pricePerMin)}/min</Text>
              <Text style={styles.typeDesc} numberOfLines={3} ellipsizeMode="tail">{type.desc}</Text>
            </AppCard>
          ))}
        </View>

        {/* Minutos */}
        <Text style={styles.overline}>MINUTOS CONTRATADOS</Text>
        {currentStep === 2 && (
          <Text style={styles.stepHint}>Passo 2 — Toque no − para diminuir ou no + para aumentar os minutos. O preço atualiza na hora.</Text>
        )}
        <Text style={styles.minutesHint}>
          A chamada encerra automaticamente ao atingir o tempo. Minutos não usados viram saldo em banco de horas.
        </Text>
        <View style={styles.minutesStepperRow}>
          <TouchableOpacity
            style={[styles.stepperBtn, durationMinutes <= CONSULTATION_MIN_MINUTES && styles.stepperBtnDisabled]}
            onPress={removeMinutes}
            disabled={durationMinutes <= CONSULTATION_MIN_MINUTES}
          >
            <Ionicons name="remove" size={24} color={durationMinutes <= CONSULTATION_MIN_MINUTES ? c.text.tertiary : c.primary.main} />
          </TouchableOpacity>
          <Text style={styles.minutesStepperValue}>{durationMinutes} min</Text>
          <TouchableOpacity
            style={[styles.stepperBtn, durationMinutes >= CONSULTATION_MAX_MINUTES && styles.stepperBtnDisabled]}
            onPress={addMinutes}
            disabled={durationMinutes >= CONSULTATION_MAX_MINUTES}
          >
            <Ionicons name="add" size={24} color={durationMinutes >= CONSULTATION_MAX_MINUTES ? c.text.tertiary : c.primary.main} />
          </TouchableOpacity>
        </View>

        {/* Sintomas */}
        <Text style={styles.overline}>DESCREVA SEUS SINTOMAS / DÚVIDA</Text>
        {currentStep === 3 && (
          <Text style={styles.stepHint}>Passo 3 — Escreva o que você está sentindo ou a dúvida que tem. Isso ajuda o profissional a te atender melhor.</Text>
        )}
        <TextInput
          style={styles.textArea}
          placeholder="O que você está sentindo? Desde quando? O que gostaria de esclarecer?"
          placeholderTextColor={c.text.tertiary}
          value={symptoms}
          onChangeText={setSymptoms}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Saldo banco de horas */}
        {!loadingBank && bankMinutes > 0 && (
          <AppCard style={styles.bankCard}>
            <View style={styles.bankRow}>
              <Ionicons name="time" size={18} color={c.status.success ?? '#16a34a'} />
              <Text style={styles.bankText}>
                Você tem <Text style={styles.bankBold}>{bankMinutes} min</Text> gratuitos disponíveis no banco de horas
              </Text>
            </View>
          </AppCard>
        )}

        {/* Total */}
        <AppCard style={styles.totalCard}>
          {freeMinutes > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {freeMinutes} min gratuitos (banco de horas)
              </Text>
              <Text style={styles.discountValue}>-{formatBRL(pricePerMin * freeMinutes)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {paidMinutes} min × {formatBRL(pricePerMin)}/min
            </Text>
            <Text style={styles.totalValue}>{formatBRL(totalPrice)}</Text>
          </View>
          {freeMinutes > 0 && paidMinutes === 0 && (
            <Text style={styles.freeLabel}>Consulta gratuita pelo banco de horas!</Text>
          )}
        </AppCard>

      </ScrollView>
      <StickyCTA
        summaryTitle="Total agora"
        summaryValue={formatBRL(totalPrice)}
        summaryHint={`${completeness.score}% pronto • ${freeMinutes > 0 ? `${freeMinutes} min gratuitos aplicados` : `${paidMinutes} min cobrados`}`}
        primary={{
          label: 'Solicitar consulta',
          onPress: handleSubmit,
          loading,
          disabled: loading,
        }}
      />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingBottom: s.xl,
  },
  assistantCard: {
    marginTop: s.md,
    borderWidth: 1,
    borderColor: c.primary.soft,
    backgroundColor: c.primary.soft + '66',
  },
  assistantCardLoading: { opacity: 0.95 },
  assistantLoading: { marginLeft: 'auto' },
  assistantHeader: { flexDirection: 'row', alignItems: 'center', gap: s.xs },
  assistantTitle: { fontSize: 13, fontWeight: '700', color: c.primary.main },
  assistantProgress: { marginTop: 6, fontSize: 14, fontWeight: '700', color: c.text.primary },
  assistantMissing: { marginTop: 6, fontSize: 12, lineHeight: 18, color: c.text.secondary },
  assistantGood: { marginTop: 8, fontSize: 12, fontWeight: '700', color: c.status.success },
  redFlagCard: {
    marginTop: s.sm,
    marginBottom: s.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    padding: s.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s.sm,
  },
  redFlagText: { flex: 1, color: '#991B1B', fontSize: 12, lineHeight: 18 },
  banner: {
    alignItems: 'center',
    marginBottom: s.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: c.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s.sm,
  },
  bannerTitle: {
    ...t.variants.h3,
    color: c.text.primary,
    marginTop: s.xs,
  },
  bannerDesc: {
    ...t.variants.body2,
    color: c.text.secondary,
    textAlign: 'center',
    marginTop: s.xs,
  },
  overline: {
    ...t.variants.overline,
    color: c.text.secondary,
    marginBottom: s.sm,
  },
  stepHint: {
    fontSize: 13,
    color: c.text.secondary,
    marginBottom: s.sm,
    lineHeight: 20,
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
    color: c.text.primary,
  },
  typeNameSelected: {
    color: c.primary.main,
  },
  typePricePerMin: {
    fontSize: t.fontSize.lg,
    fontWeight: '700',
    color: c.text.primary,
    marginTop: s.xs,
  },
  typeDesc: {
    fontSize: t.fontSize.xs,
    color: c.text.tertiary,
    marginTop: s.xs,
    lineHeight: 16,
  },
  minutesHint: {
    fontSize: t.fontSize.sm,
    color: c.text.secondary,
    marginBottom: s.sm,
    lineHeight: 18,
  },
  minutesStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.lg,
    marginBottom: s.lg,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.primary.soft ?? '#EFF6FF',
    borderWidth: 2,
    borderColor: c.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.5,
    borderColor: c.border.main,
  },
  minutesStepperValue: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text.primary,
    minWidth: 72,
    textAlign: 'center',
  },
  textArea: {
    backgroundColor: c.background.secondary,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.border.main,
    padding: s.md,
    fontSize: t.fontSize.md,
    color: c.text.primary,
    minHeight: 120,
    marginBottom: s.lg,
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
    ...t.variants.body2,
    color: c.text.secondary,
    flex: 1,
  },
  totalValue: {
    ...t.variants.h2,
    color: c.primary.main,
  },
  discountValue: {
    ...t.variants.h3,
    color: '#16a34a',
  },
  freeLabel: {
    fontSize: t.fontSize.sm,
    color: '#16a34a',
    fontWeight: '600',
    marginTop: s.xs,
    textAlign: 'center',
  },
  bankCard: {
    marginBottom: s.md,
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  bankText: {
    fontSize: t.fontSize.sm,
    color: '#166534',
    flex: 1,
    lineHeight: 18,
  },
  bankBold: {
    fontWeight: '700',
  },
});
