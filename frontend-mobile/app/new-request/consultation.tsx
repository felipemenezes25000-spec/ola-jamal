import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import { createConsultationRequest } from '../../lib/api';
import { FALLBACK_CONSULTATION_PRICE } from '../../lib/config/pricing';
import { getApiErrorMessage } from '../../lib/api-client';
import { validate } from '../../lib/validation';
import { createConsultationSchema } from '../../lib/validation/schemas';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { AppCard } from '../../components/ui/AppCard';
import { AppButton } from '../../components/ui/AppButton';

const c = theme.colors;
const s = theme.spacing;
const r = theme.borderRadius;
const t = theme.typography;

export default function ConsultationScreen() {
  const router = useRouter();
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const validation = validate(createConsultationSchema, { symptoms });
    if (!validation.success) {
      Alert.alert('Atenção', validation.firstError ?? 'Descreva seus sintomas para continuar.');
      return;
    }
    setLoading(true);
    try {
      const result = await createConsultationRequest(validation.data!);
      if (result.payment) {
        router.replace(`/payment/${result.payment.id}`);
      } else {
        Alert.alert('Sucesso', 'Consulta solicitada! Aguarde um médico aceitar.', [
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
      <AppHeader title="Nova Consulta" />

      <View style={styles.content}>
        {/* Info Banner */}
        <AppCard style={styles.infoBanner}>
          <View style={styles.iconCircle}>
            <Ionicons name="videocam" size={28} color={c.primary.main} />
          </View>
          <Text style={styles.bannerTitle}>Consulta por Videochamada</Text>
          <Text style={styles.bannerDesc}>
            Um médico atenderá você em poucos minutos após o pagamento.
          </Text>
        </AppCard>

        {/* Symptoms Input */}
        <Text style={styles.overline}>DESCREVA SEUS SINTOMAS</Text>
        <TextInput
          style={styles.textArea}
          placeholder="O que você está sentindo? Desde quando? Há quanto tempo?..."
          placeholderTextColor={c.text.tertiary}
          value={symptoms}
          onChangeText={setSymptoms}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        {/* Info notice */}
        <View style={styles.infoNotice}>
          <Ionicons name="information-circle" size={20} color={c.status.info} />
          <Text style={styles.infoText}>
            Sua solicitação será analisada por um médico disponível. Após a aceitação, você receberá uma notificação para efetuar o pagamento.
          </Text>
        </View>

        {/* Price Card */}
        <AppCard style={styles.priceCard}>
          <Text style={styles.priceLabel}>Valor da consulta</Text>
          <Text style={styles.priceValue}>R$ {FALLBACK_CONSULTATION_PRICE.toFixed(2).replace('.', ',')}</Text>
        </AppCard>

        {/* Submit Button */}
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
    paddingHorizontal: s.md,
    paddingBottom: s.xl,
  },
  infoBanner: {
    alignItems: 'center',
    marginBottom: s.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  textArea: {
    backgroundColor: c.background.secondary,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: c.border.main,
    padding: s.md,
    fontSize: t.fontSize.md,
    color: c.text.primary,
    minHeight: 140,
    marginBottom: s.md,
  },
  infoNotice: {
    flexDirection: 'row',
    backgroundColor: c.status.infoLight,
    borderRadius: r.md,
    padding: s.md,
    gap: s.sm,
    marginBottom: s.lg,
  },
  infoText: {
    flex: 1,
    fontSize: t.fontSize.sm,
    color: c.text.secondary,
    lineHeight: 18,
  },
  priceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.lg,
  },
  priceLabel: {
    ...t.variants.body2,
    color: c.text.secondary,
  },
  priceValue: {
    ...t.variants.h2,
    color: c.primary.main,
  },
});
