import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import { fetchPayment, fetchPixCode, syncPaymentStatus } from '../../lib/api';
import { formatBRL } from '../../lib/utils/format';
import { PaymentResponseDto } from '../../types/database';

type PayScreen = 'selection' | 'pix';

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const paymentId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentResponseDto | null>(null);
  const [pixCode, setPixCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<PayScreen>('selection');
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const MAX_POLLS = 180; // 180 × 5s = 15 min

  useEffect(() => {
    loadPayment();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [paymentId]);

  const loadPayment = async () => {
    if (!paymentId) return;
    try {
      const data = await fetchPayment(paymentId);
      setPayment(data);
      if (data.status === 'approved') {
        Alert.alert('✅ Pagamento confirmado!', 'Seu pagamento já foi aprovado.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      // Se o pagamento já tem dados PIX (criado via /payment/request/[requestId]),
      // pular direto para a tela do QR code sem precisar clicar novamente
      if (data.paymentMethod === 'pix' && (data.pixQrCodeBase64 || data.pixCopyPaste)) {
        setScreen('pix');
        setPixCode(data.pixCopyPaste || '');
        startPolling();
      } else if (data.paymentMethod === 'pix') {
        // Pagamento PIX criado mas sem QR code ainda — buscar e ir direto
        setScreen('pix');
        try {
          const code = await fetchPixCode(data.id);
          setPixCode(code);
        } catch (e) {
          console.error('Error fetching PIX code:', e);
        }
        // Re-fetch payment to get QR code base64 that may have been generated
        try {
          const refreshed = await fetchPayment(paymentId);
          setPayment(refreshed);
        } catch {}
        startPolling();
      }
    } catch (e: unknown) {
      Alert.alert('Erro', (e as Error)?.message || String(e) || 'Erro ao carregar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPix = async () => {
    setScreen('pix');
    try {
      if (payment) {
        const code = await fetchPixCode(payment.id);
        setPixCode(code);
      }
    } catch (e) {
      console.error('Error fetching PIX code:', e);
    }
    startPolling();
  };

  const handleSelectCard = () => {
    if (!payment) return;
    router.push({ pathname: '/payment/card', params: { requestId: payment.requestId } });
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollCountRef.current = 0;
    setPolling(true);
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLLS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setPolling(false);
        return;
      }
      try {
        // A cada 6 polls (30s), sincroniza com MP para resolver webhooks falhados
        const useSync = pollCountRef.current % 6 === 0 && payment?.requestId;
        const updated = useSync
          ? await syncPaymentStatus(payment!.requestId)
          : await fetchPayment(paymentId!);
        setPayment(updated);
        if (updated.status === 'approved') {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
          Alert.alert('Pagamento confirmado!', 'Seu pagamento foi aprovado com sucesso.', [
            { text: 'Ver pedido', onPress: () => router.replace(`/request-detail/${updated.requestId}`) },
          ]);
        }
      } catch {}
    }, 5000);
  };

  const handleCopyPix = async () => {
    const code = payment?.pixCopyPaste || pixCode;
    if (code) {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleCheckStatus = async () => {
    if (!payment?.requestId) return;
    setPolling(true);
    try {
      // Sincroniza com Mercado Pago (resolve caso webhook tenha falhado)
      const synced = await syncPaymentStatus(payment.requestId);
      setPayment(synced);
      if (synced.status === 'approved') {
        if (pollRef.current) clearInterval(pollRef.current);
        Alert.alert('Pagamento confirmado!', 'Seu pagamento foi aprovado.', [
          { text: 'Ver pedido', onPress: () => router.replace(`/request-detail/${synced.requestId}`) },
        ]);
      } else {
        Alert.alert('Aguardando', 'Pagamento ainda não confirmado pelo Mercado Pago. Tente novamente em alguns segundos.');
      }
    } catch (e: unknown) {
      // Fallback: tenta buscar o pagamento normalmente
      try {
        const updated = await fetchPayment(paymentId!);
        setPayment(updated);
        if (updated.status === 'approved') {
          if (pollRef.current) clearInterval(pollRef.current);
          Alert.alert('Pagamento confirmado!', '', [
            { text: 'Ver pedido', onPress: () => router.replace(`/request-detail/${updated.requestId}`) },
          ]);
          return;
        }
      } catch { /* ignore fallback error */ }
      Alert.alert('Erro', (e as Error)?.message || String(e) || 'Erro ao verificar status');
    } finally {
      setPolling(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Selection screen
  if (screen === 'selection') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pagamento</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.selectionCard}>
            <View style={styles.selectionIcon}>
              <Ionicons name="qr-code" size={40} color={colors.primary} />
            </View>
            <Text style={styles.selectionTitle}>Escolha a forma de pagamento</Text>
            <Text style={styles.selectionDesc}>
              Selecione o método de sua preferência para realizar o pagamento.
            </Text>

            <TouchableOpacity style={styles.pixButton} onPress={handleSelectPix} activeOpacity={0.8}>
              <Ionicons name="qr-code" size={20} color="#fff" />
              <Text style={styles.pixButtonText}>Pagar com PIX</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardButton} onPress={handleSelectCard} activeOpacity={0.8}>
              <Ionicons name="card" size={20} color={colors.primary} />
              <Text style={styles.cardButtonText}>Pagar com Cartão</Text>
            </TouchableOpacity>

            <View style={styles.priceDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Valor</Text>
              <Text style={styles.priceValue}>{formatBRL(payment?.amount ?? 0)}</Text>
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

  // PIX screen
  const pixCopyPaste = payment?.pixCopyPaste || pixCode;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setScreen('selection')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pagamento</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.pixCard}>
          <Text style={styles.pixLabel}>PAGUE VIA PIX</Text>
          <Text style={styles.pixAmount}>{formatBRL(payment?.amount ?? 0)}</Text>

          {/* QR Code */}
          {payment?.pixQrCodeBase64 ? (
            <View style={styles.qrContainer}>
              <Image
                source={{ uri: `data:image/png;base64,${payment.pixQrCodeBase64}` }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>
          ) : (
            <View style={[styles.qrContainer, styles.qrPlaceholder]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.qrLoadingText}>Gerando QR Code...</Text>
            </View>
          )}

          {/* Copy-paste code */}
          {pixCopyPaste && (
            <>
              <Text style={styles.copyLabel}>Código PIX Copia e Cola:</Text>
              <TouchableOpacity style={styles.copyRow} onPress={handleCopyPix} activeOpacity={0.7}>
                <Text style={styles.copyCode} numberOfLines={1}>{pixCopyPaste}</Text>
                <Ionicons name={copied ? 'checkmark' : 'copy'} size={20} color={copied ? colors.success : colors.primary} />
              </TouchableOpacity>
              {copied && <Text style={styles.copiedText}>Código copiado!</Text>}
            </>
          )}

          {/* Instructions */}
          <View style={styles.instructionRow}>
            <Ionicons name="information-circle" size={18} color={colors.textMuted} />
            <Text style={styles.instructionText}>
              Abra o app do seu banco, escolha a opção PIX, e selecione "Ler QR Code" ou "Copia e Cola". O pagamento é confirmado instantaneamente.
            </Text>
          </View>
        </View>

        <View style={styles.securityRow}>
          <Ionicons name="shield-checkmark" size={16} color={colors.success} />
          <Text style={styles.securityText}>PAGAMENTO 100% SEGURO</Text>
        </View>

        {/* Check button */}
        <TouchableOpacity style={styles.checkButton} onPress={handleCheckStatus} disabled={polling} activeOpacity={0.8}>
          {polling ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.checkButtonText}>Já Paguei — Verificar Status</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, ...shadows.card,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },

  // Selection
  selectionCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.lg, alignItems: 'center', ...shadows.card,
  },
  selectionIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  selectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  selectionDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  pixButton: {
    backgroundColor: colors.primary, borderRadius: 26, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    width: '100%', marginBottom: spacing.sm,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  pixButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cardButton: {
    borderWidth: 2, borderColor: colors.primary, borderRadius: 26, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    width: '100%', backgroundColor: colors.surface,
  },
  cardButtonText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  priceDivider: { height: 1, backgroundColor: colors.border, width: '100%', marginVertical: spacing.md },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  priceLabel: { fontSize: 14, color: colors.textSecondary },
  priceValue: { fontSize: 20, fontWeight: '700', color: colors.text },

  // PIX
  pixCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.lg, alignItems: 'center', ...shadows.card, marginBottom: spacing.md,
  },
  pixLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  pixAmount: { fontSize: 32, fontWeight: '700', color: colors.text, marginVertical: spacing.sm },
  qrContainer: {
    width: 200, height: 200, borderRadius: borderRadius.md,
    borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginVertical: spacing.md,
    overflow: 'hidden',
  },
  qrImage: { width: 180, height: 180 },
  qrPlaceholder: { gap: spacing.sm },
  qrLoadingText: { fontSize: 12, color: colors.textMuted },
  copyLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, alignSelf: 'flex-start', marginBottom: spacing.xs },
  copyRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.sm, padding: spacing.sm, width: '100%', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  copyCode: { flex: 1, fontSize: 13, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  copiedText: { fontSize: 12, color: colors.success, marginTop: spacing.xs },
  instructionRow: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md,
    backgroundColor: colors.primaryLight, borderRadius: borderRadius.sm, padding: spacing.sm,
  },
  instructionText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  // Security
  securityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.md,
  },
  securityText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  // Check button
  checkButton: {
    backgroundColor: colors.primary, borderRadius: 26, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  checkButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
