import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
  useWindowDimensions,
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
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';

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

  useEffect(() => {
    let cancelled = false;
    setLoadingBank(true);
    getTimeBankBalance(consultationType)
      .then(res => { if (!cancelled) setBankMinutes(res.balanceMinutes); })
      .catch(() => { if (!cancelled) setBankMinutes(0); })
      .finally(() => { if (!cancelled) setLoadingBank(false); });
    return () => { cancelled = true; };
  }, [consultationType]);

  const pricePerMin = CONSULTATION_PRICE_PER_MINUTE[consultationType];
  const { freeMinutes, paidMinutes, totalPrice } = useMemo(() => {
    const free = Math.min(bankMinutes, durationMinutes);
    const paid = durationMinutes - free;
    const total = Math.round(pricePerMin * paid * 100) / 100;
    return { freeMinutes: free, paidMinutes: paid, totalPrice: total };
  }, [pricePerMin, durationMinutes, bankMinutes]);

  const handleSubmit = async () => {
    const validation = validate(createConsultationSchema, {
      consultationType,
      durationMinutes,
      symptoms,
    });
    if (!validation.success) {
      Alert.alert('Atenção', validation.firstError ?? 'Preencha todos os campos.');
      return;
    }
    setLoading(true);
    try {
      const result = await createConsultationRequest(validation.data!);
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

  return (
    <Screen scroll edges={['bottom']}>
      <AppHeader title="Consulta Breve" />

      <View style={styles.content}>
        {/* Banner */}
        <AppCard style={styles.banner}>
          <View style={styles.iconCircle}>
            <Ionicons name="videocam" size={28} color={c.primary.main} />
          </View>
          <Text style={styles.bannerTitle}>Consulta Breve - RenoveJá+</Text>
          <Text style={styles.bannerDesc}>
            Plantão de dúvidas em telemedicina para sanar dúvidas pontuais!
          </Text>
        </AppCard>

        {/* Tipo: Psicólogo ou Médico Clínico */}
        <Text style={styles.overline}>TIPO DE PROFISSIONAL</Text>
        <Text style={styles.stepHint}>Passo 1 — Escolha com quem você quer falar. Toque em Psicólogo ou Médico Clínico.</Text>
        <View style={[styles.typeRow, oneColumn && styles.typeRowOneCol]}>
          {CONSULTATION_TYPES.map(type => (
            <AppCard
              key={type.key}
              selected={consultationType === type.key}
              onPress={() => setConsultationType(type.key)}
              style={[styles.typeCard, oneColumn && styles.typeCardFull]}
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
        <Text style={styles.stepHint}>Passo 2 — Toque no − para diminuir ou no + para aumentar os minutos. O preço atualiza na hora.</Text>
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
        <Text style={styles.stepHint}>Passo 3 — Escreva o que você está sentindo ou a dúvida que tem. Isso ajuda o profissional a te atender melhor.</Text>
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
              <Ionicons name="time" size={18} color={c.success?.main ?? '#16a34a'} />
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

        <Text style={styles.stepHint}>Pronto? Toque no botão abaixo para solicitar sua consulta.</Text>
        <AppButton
          title="Solicitar Consulta"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          fullWidth
          icon="videocam"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingBottom: s.xl,
  },
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
