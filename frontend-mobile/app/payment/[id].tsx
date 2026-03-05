import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  AppState,
  AppStateStatus,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import { fetchPayment, fetchPixCode, syncPaymentStatus } from '../../lib/api';
import { formatBRL, formatTimeBR } from '../../lib/utils/format';
import { PaymentResponseDto } from '../../types/database';
import { PaymentHeader } from '../../components/payment/PaymentHeader';
import { PaymentMethodSelection } from '../../components/payment/PaymentMethodSelection';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

type PayScreen = 'selection' | 'pix';

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const paymentId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentResponseDto | null>(null);
  const [pixCode, setPixCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<PayScreen>('selection');
  const [autoPolling, setAutoPolling] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [selectingPix, setSelectingPix] = useState(false);
  const [navigatingToRequest, setNavigatingToRequest] = useState(false);
  const { isConnected } = useNetworkStatus();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const paymentRef = useRef<PaymentResponseDto | null>(null);
  const MAX_POLLS = 180; // 180 × 5s = 15 min
  const PIX_EXPIRATION_MINUTES = 30;

  useEffect(() => {
    paymentRef.current = payment;
  }, [payment]);

  useEffect(() => {
    loadPayment();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [paymentId]);

  // Verifica status imediatamente quando o usuário volta ao app (ex.: após pagar PIX no app do banco)
  const checkPaymentStatusOnResume = useCallback(async () => {
    const current = paymentRef.current;
    if (!paymentId || !current?.requestId || current.status === 'approved') return;
    try {
      const synced = await syncPaymentStatus(current.requestId);
      setPayment(synced);
      setLastCheckedAt(new Date());
      if (synced.status === 'approved') {
        if (pollRef.current) clearInterval(pollRef.current);
        setAutoPolling(false);
      }
    } catch { /* ignora erro silenciosamente */ }
  }, [paymentId]);

  useEffect(() => {
    if (screen !== 'pix') return;
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkPaymentStatusOnResume();
      }
    });
    return () => subscription.remove();
  }, [screen, checkPaymentStatusOnResume]);

  const loadPayment = async () => {
    if (!paymentId) return;
    try {
      const data = await fetchPayment(paymentId);
      setPayment(data);
      if (data.status === 'approved') {
        setScreen('pix'); // Mostra tela PIX com botão "Pagamento Aprovado"
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
    if (selectingPix) return;
    if (isConnected === false) {
      Alert.alert('Sem conexão', 'Conecte-se à internet para gerar o PIX.');
      return;
    }
    setSelectingPix(true);
    setScreen('pix');
    try {
      if (payment) {
        const code = await fetchPixCode(payment.id);
        setPixCode(code);
      }
    } catch (e) {
      console.error('Error fetching PIX code:', e);
      Alert.alert('Erro', 'Não foi possível gerar o código PIX agora. Tente novamente.');
    } finally {
      setSelectingPix(false);
    }
    startPolling();
  };

  const handleSelectCard = () => {
    if (!payment) return;
    if (isConnected === false) {
      Alert.alert('Sem conexão', 'Conecte-se à internet para continuar com cartão.');
      return;
    }
    router.push({ pathname: '/payment/card', params: { requestId: payment.requestId } });
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollCountRef.current = 0;
    setAutoPolling(true);
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLLS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setAutoPolling(false);
        return;
      }
      const currentPayment = paymentRef.current;
      const reqId = currentPayment?.requestId;
      try {
        // A cada 6 polls (30s), sincroniza com MP para resolver webhooks falhados
        const useSync = pollCountRef.current % 6 === 0 && reqId;
        const updated = useSync && reqId
          ? await syncPaymentStatus(reqId)
          : await fetchPayment(paymentId!);
        setPayment(updated);
        if (updated.status === 'approved') {
          if (pollRef.current) clearInterval(pollRef.current);
          setAutoPolling(false);
          setPayment(updated); // Mostra card com botão "Ver Pedido"
        }
      } catch {}
    }, 5000);
  };

  const handleCopyPix = async () => {
    const code = payment?.pixCopyPaste || pixCode;
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      Alert.alert('Erro', 'Não foi possível copiar o código PIX.');
    }
  };

  const handleOpenBankApp = () => {
    Alert.alert(
      'Abrir app do banco',
      'Abra o aplicativo do seu banco e use a opção PIX com QR Code ou código copia e cola. Se preferir, copie o código e cole direto no banco.',
      [{ text: 'OK' }]
    );
  };

  const handleCheckStatus = async () => {
    if (!payment?.requestId || checkingNow) return;
    if (isConnected === false) {
      Alert.alert('Sem conexão', 'Conecte-se à internet para verificar o pagamento.');
      return;
    }
    setCheckingNow(true);
    try {
      // Sincroniza com Mercado Pago (resolve caso webhook tenha falhado)
      const synced = await syncPaymentStatus(payment.requestId);
      setPayment(synced);
      setLastCheckedAt(new Date());
      if (synced.status === 'approved') {
        if (pollRef.current) clearInterval(pollRef.current);
        setAutoPolling(false);
        setPayment(synced); // Mostra card com botão "Ver Pedido"
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
          setAutoPolling(false);
          setPayment(updated); // Mostra card com botão "Ver Pedido"
          return;
        }
      } catch { /* ignore fallback error */ }
      Alert.alert('Erro', (e as Error)?.message || String(e) || 'Erro ao verificar status');
    } finally {
      setCheckingNow(false);
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
        <PaymentHeader onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.scroll}>
          {isConnected === false && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
              <Text style={styles.offlineText}>Sem internet no momento. Algumas ações ficam indisponíveis.</Text>
            </View>
          )}
          <PaymentMethodSelection
            amount={payment?.amount ?? 0}
            onSelectPix={handleSelectPix}
            onSelectCard={handleSelectCard}
            pixLoading={selectingPix}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // PIX screen
  const pixCopyPaste = payment?.pixCopyPaste || pixCode;
  const isApproved = payment?.status === 'approved';
  const pixExpiresAt = payment ? new Date(new Date(payment.createdAt).getTime() + PIX_EXPIRATION_MINUTES * 60 * 1000) : null;
  const expiresInMinutes = pixExpiresAt ? Math.floor((pixExpiresAt.getTime() - Date.now()) / 60000) : null;

  return (
    <SafeAreaView style={styles.container}>
      <PaymentHeader onBack={() => setScreen('selection')} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {isConnected === false && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
            <Text style={styles.offlineText}>Sem internet no momento. Algumas ações ficam indisponíveis.</Text>
          </View>
        )}
        {/* Estado de pagamento aprovado — botão funcional para ir ao pedido */}
        {isApproved && payment?.requestId ? (
          <View style={styles.approvedCard}>
            <View style={styles.approvedIcon}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            </View>
            <Text style={styles.approvedTitle}>Pagamento confirmado!</Text>
            <Text style={styles.approvedSubtitle}>Seu pagamento foi aprovado com sucesso.</Text>
            <TouchableOpacity
              style={[styles.approvedButton, navigatingToRequest && styles.buttonDisabled]}
              onPress={() => {
                if (navigatingToRequest) return;
                setNavigatingToRequest(true);
                router.replace(`/request-detail/${payment.requestId}`);
              }}
              disabled={navigatingToRequest}
              activeOpacity={0.8}
            >
              {navigatingToRequest ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.approvedButtonText}>Ver Pedido</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.white} />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
        <View style={styles.pixCard}>
          <Text style={styles.pixLabel}>Pague via PIX</Text>
          <Text style={styles.pixAmount}>{formatBRL(payment?.amount ?? 0)}</Text>
          {expiresInMinutes != null && (
            <Text style={styles.expirationText}>
              {expiresInMinutes >= 0 ? `Expira em ${expiresInMinutes} min (estimado)` : 'Código possivelmente expirado (estimado)'}
            </Text>
          )}

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
              <TouchableOpacity style={styles.copyButton} onPress={handleCopyPix} activeOpacity={0.8}>
                <Ionicons name="copy-outline" size={18} color={colors.white} />
                <Text style={styles.copyButtonText}>Copiar código PIX</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bankButton} onPress={handleOpenBankApp} activeOpacity={0.8}>
                <Ionicons name="open-outline" size={18} color={colors.primary} />
                <Text style={styles.bankButtonText}>Abrir app do banco</Text>
              </TouchableOpacity>
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
          <Text style={styles.securityText}>Pagamento 100% seguro</Text>
        </View>

        {/* Check button */}
        <TouchableOpacity
          style={[styles.checkButton, (checkingNow || isConnected === false) && styles.buttonDisabled]}
          onPress={handleCheckStatus}
          disabled={checkingNow || isConnected === false}
          activeOpacity={0.8}
        >
          {checkingNow ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="refresh" size={20} color={colors.white} />
              <Text style={styles.checkButtonText}>Já paguei</Text>
            </>
          )}
        </TouchableOpacity>
        {checkingNow && (
          <Text style={styles.checkingText}>Verificando pagamento...</Text>
        )}
        {!checkingNow && autoPolling && !isApproved && (
          <Text style={styles.lastCheckedText}>
            Acompanhamento automático ativo. A confirmação pode levar alguns segundos.
          </Text>
        )}
        {lastCheckedAt && (
          <Text style={styles.lastCheckedText}>
            Última verificação: {formatTimeBR(lastCheckedAt)}
          </Text>
        )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  offlineBanner: {
    marginBottom: spacing.md,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  offlineText: { flex: 1, fontSize: 12, color: colors.textSecondary },

  // PIX
  pixCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.lg, alignItems: 'center', ...shadows.card, marginBottom: spacing.md,
  },
  pixLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
  pixAmount: { fontSize: 32, fontWeight: '700', color: colors.text, marginVertical: spacing.sm },
  expirationText: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
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
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.sm, padding: spacing.sm, width: '100%', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  copyCode: { flex: 1, fontSize: 13, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  copiedText: { fontSize: 12, color: colors.success, marginTop: spacing.xs },
  copyButton: {
    marginTop: spacing.sm,
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 22,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  copyButtonText: { fontSize: 14, fontWeight: '700', color: colors.white },
  bankButton: {
    marginTop: spacing.xs,
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 22,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  bankButtonText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  instructionRow: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md,
    backgroundColor: colors.primaryLight, borderRadius: borderRadius.sm, padding: spacing.sm,
  },
  instructionText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  securityRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  securityText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  // Approved state
  approvedCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.xl,
    alignItems: 'center', ...shadows.card, marginBottom: spacing.md,
  },
  approvedIcon: { marginBottom: spacing.md },
  approvedTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  approvedSubtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: spacing.lg },
  approvedButton: {
    backgroundColor: colors.success, borderRadius: 26, paddingVertical: 16, paddingHorizontal: spacing.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    width: '100%', shadowColor: colors.success, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  approvedButtonText: { fontSize: 17, fontWeight: '700', color: colors.white },

  // Check button
  checkButton: {
    backgroundColor: colors.primary, borderRadius: 26, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  checkButtonText: { fontSize: 16, fontWeight: '700', color: colors.white },
  buttonDisabled: { opacity: 0.6 },
  checkingText: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  lastCheckedText: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
