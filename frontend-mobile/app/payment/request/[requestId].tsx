import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../../lib/theme';
import { fetchRequestById, createPayment } from '../../../lib/api';
import { getDisplayPrice } from '../../../lib/config/pricing';
import { formatBRL } from '../../../lib/utils/format';
import { getApiErrorMessage } from '../../../lib/api-client';
import type { RequestResponseDto } from '../../../types/database';

export default function PaymentRequestScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const rid = Array.isArray(requestId) ? requestId[0] : requestId;
  const router = useRouter();
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [pixLoading, setPixLoading] = useState(false);
  const pixInFlightRef = useRef(false);

  useEffect(() => {
    if (!rid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRequestById(rid);
        if (!cancelled) setRequest(data);
      } catch (e: unknown) {
        if (!cancelled) {
          Alert.alert('Erro', (e as Error)?.message || String(e) || 'Erro ao carregar solicitação');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [rid]);

  const handleSelectPix = async () => {
    if (!rid || pixInFlightRef.current) return;
    pixInFlightRef.current = true;
    setPixLoading(true);
    try {
      const payment = await createPayment({ requestId: rid, paymentMethod: 'pix' });
      const targetUrl = `/payment/${payment.id}`;
      router.replace(targetUrl);
    } catch (error: unknown) {
      const msg = getApiErrorMessage(error);
      Alert.alert('Erro ao gerar pagamento', msg);
    } finally {
      setPixLoading(false);
      pixInFlightRef.current = false;
    }
  };

  const handleSelectCard = () => {
    if (!rid) return;
    router.push({ pathname: '/payment/card', params: { requestId: rid } });
  };

  const amount = request ? getDisplayPrice(request.price, request.requestType) : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pagamento</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Solicitação não encontrada</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pagamento</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.selectionCard}>
          <View style={styles.selectionIcon}>
            <Ionicons name="qr-code" size={40} color={colors.primary} />
          </View>
          <Text style={styles.selectionTitle}>Escolha a forma de pagamento</Text>
          <Text style={styles.selectionDesc}>
            Selecione o método de sua preferência para realizar o pagamento.
          </Text>

          <TouchableOpacity
            style={styles.pixButton}
            onPress={handleSelectPix}
            disabled={pixLoading}
            activeOpacity={0.8}
          >
            <View style={styles.pixButtonContent}>
              <Ionicons name="qr-code" size={20} color="#fff" />
              <Text style={styles.pixButtonText}>Pagar com PIX</Text>
            </View>
            {pixLoading && (
              <View style={styles.pixButtonOverlay} pointerEvents="none">
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cardButton} onPress={handleSelectCard} activeOpacity={0.8}>
            <Ionicons name="card" size={20} color={colors.primary} />
            <Text style={styles.cardButtonText}>Pagar com Cartão</Text>
          </TouchableOpacity>

          <View style={styles.priceDivider} />
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Valor</Text>
            <Text style={styles.priceValue}>{formatBRL(amount)}</Text>
          </View>
        </View>

        <View style={styles.securityRow}>
          <Ionicons name="shield-checkmark" size={16} color={colors.success} />
          <Text style={styles.securityText}>Pagamento 100% seguro</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  selectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  selectionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  selectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  selectionDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  pixButton: {
    backgroundColor: colors.primary,
    borderRadius: 26,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
    marginBottom: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
    position: 'relative',
  },
  pixButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pixButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pixButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cardButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 26,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
    backgroundColor: colors.surface,
  },
  cardButtonText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  priceDivider: { height: 1, backgroundColor: colors.border, width: '100%', marginVertical: spacing.md },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  priceLabel: { fontSize: 14, color: colors.textSecondary },
  priceValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  securityText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  errorText: { fontSize: 16, color: colors.textSecondary },
});
