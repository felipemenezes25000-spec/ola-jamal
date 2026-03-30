import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { spacing, borderRadius, shadows } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { fetchPayment, fetchPixCode, syncPaymentStatus } from '../../lib/api';
import { usePaymentQuery, usePaymentQueryHelpers, PaymentRedirectError } from '../../lib/hooks';
import { formatBRL, formatTimeBR } from '../../lib/utils/format';
import { PaymentHeader } from '../../components/payment/PaymentHeader';
import { PaymentMethodSelection } from '../../components/payment/PaymentMethodSelection';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { AppEmptyState } from '../../components/ui';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { showToast } from '../../components/ui/Toast';

type PayScreen = 'selection' | 'pix';

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const paymentId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { setPaymentData } = usePaymentQueryHelpers();
  const [pixCode, setPixCode] = useState<string>('');
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
  const MAX_POLLS = 180; // 180 × 5s = 15 min
  const PIX_EXPIRATION_MINUTES = 30;

  const {
    data: payment,
    isLoading: loading,
    isError: hasLoadError,
    error: queryError,
    refetch,
    isFetched,
  } = usePaymentQuery(paymentId);
  const loadError = hasLoadError && !(queryError instanceof PaymentRedirectError)
    ? ((queryError as Error)?.message || String(queryError) || 'Erro ao carregar pagamento')
    : null;
  const paymentRef = useRef(payment);
  paymentRef.current = payment;

  // Redirect quando deep link envia requestId (PaymentRedirectError)
  useEffect(() => {
    if (queryError instanceof PaymentRedirectError && queryError.redirectTo) {
      router.replace(queryError.redirectTo as never);
    }
  }, [queryError, router]);

  // Side effects após carregar: setScreen, setPixCode, startPolling
  const startPollingRef = useRef<() => void>(() => {});
  const pixFetchStartedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!payment || !paymentId || !isFetched) return;
    if (payment.status === 'approved') {
      setScreen('pix');
      return;
    }
    if (payment.paymentMethod === 'pix' && (payment.pixQrCodeBase64 || payment.pixCopyPaste)) {
      setScreen('pix');
      setPixCode(payment.pixCopyPaste || '');
      startPollingRef.current();
    } else if (payment.paymentMethod === 'pix' && pixFetchStartedRef.current !== payment.id) {
      pixFetchStartedRef.current = payment.id;
      setScreen('pix');
      (async () => {
        try {
          const code = await fetchPixCode(payment.id);
          setPixCode(code);
        } catch (e) {
          if (__DEV__) console.error('Error fetching PIX code:', e);
        }
        try {
          const refreshed = await fetchPayment(paymentId);
          setPaymentData(paymentId, refreshed);
        } catch (e) {
          if (__DEV__) console.warn('[Payment] refresh após PIX falhou:', e);
        }
        startPollingRef.current();
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- payment fields are sufficient; full payment causes unnecessary reruns
  }, [payment?.id, payment?.status, payment?.paymentMethod, payment?.pixQrCodeBase64, payment?.pixCopyPaste, paymentId, isFetched, setPaymentData]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Verifica status imediatamente quando o usuário volta ao app (ex.: após pagar PIX no app do banco)
  const checkPaymentStatusOnResume = useCallback(async () => {
    const current = paymentRef.current;
    if (!paymentId || !current?.requestId || current.status === 'approved') return;
    try {
      const synced = await syncPaymentStatus(current.requestId);
      setPaymentData(paymentId, synced);
      setLastCheckedAt(new Date());
      if (synced.status === 'approved') {
        if (pollRef.current) clearInterval(pollRef.current);
        setAutoPolling(false);
      }
    } catch (e) {
      if (__DEV__) console.warn('[Payment] syncPaymentStatus erro:', e);
    }
  }, [paymentId, setPaymentData]);

  useEffect(() => {
    if (screen !== 'pix') return;
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkPaymentStatusOnResume();
      }
    });
    return () => subscription.remove();
  }, [screen, checkPaymentStatusOnResume]);

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

  const startPolling = useCallback(() => {
    if (!paymentId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollCountRef.current = 0;
    setAutoPolling(true);
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLLS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setAutoPolling(false);
        // FIX #28: Avisa o usuário que o acompanhamento automático expirou
        showToast({ message: 'Verificação automática encerrada. Use o botão "Já paguei" para checar.', type: 'warning' });
        return;
      }
      const currentPayment = paymentRef.current;
      const reqId = currentPayment?.requestId;
      try {
        const useSync = pollCountRef.current % 6 === 0 && reqId;
        const updated = useSync && reqId
          ? await syncPaymentStatus(reqId)
          : await fetchPayment(paymentId);
        setPaymentData(paymentId, updated);
        if (updated.status === 'approved') {
          if (pollRef.current) clearInterval(pollRef.current);
          setAutoPolling(false);
        }
      } catch (e) {
        if (__DEV__) console.warn('[Payment] polling erro:', e);
      }
    }, 5000);
  }, [paymentId, setPaymentData]);

  // Atribui startPolling ao ref para o useEffect de side effects
  startPollingRef.current = startPolling;

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
    if (!payment?.requestId || checkingNow || !paymentId) return;
    if (isConnected === false) {
      Alert.alert('Sem conexão', 'Conecte-se à internet para verificar o pagamento.');
      return;
    }
    setCheckingNow(true);
    try {
      const synced = await syncPaymentStatus(payment.requestId);
      setPaymentData(paymentId, synced);
      setLastCheckedAt(new Date());
      if (synced.status === 'approved') {
        if (pollRef.current) clearInterval(pollRef.current);
        setAutoPolling(false);
      } else {
        Alert.alert('Aguardando', 'Pagamento ainda não confirmado pelo Mercado Pago. Tente novamente em alguns segundos.');
      }
    } catch (e: unknown) {
      try {
        const updated = await fetchPayment(paymentId);
        setPaymentData(paymentId, updated);
        if (updated.status === 'approved') {
          if (pollRef.current) clearInterval(pollRef.current);
          setAutoPolling(false);
          setCheckingNow(false);
          return;
        }
      } catch (fallbackErr) {
        if (__DEV__) console.warn('[Payment] fallback fetch erro:', fallbackErr);
      }
      Alert.alert('Erro', (e as Error)?.message || String(e) || 'Erro ao verificar status');
    } finally {
      setCheckingNow(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <PaymentHeader onBack={() => router.back()} />
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <SkeletonList count={3} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container}>
        <PaymentHeader onBack={() => router.back()} />
        <View style={styles.center}>
          <AppEmptyState
            icon="alert-circle-outline"
            title="Erro ao carregar pagamento"
            subtitle={loadError}
            actionLabel="Tentar novamente"
            onAction={() => refetch()}
          />
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
  // FIX #20: Usa expiresAt do backend se disponível (Mercado Pago define a expiração real),
  // senão calcula fallback com PIX_EXPIRATION_MINUTES
  const pixExpiresAt = payment
    ? ((payment as any).expiresAt
      ? new Date((payment as any).expiresAt)
      : new Date(new Date(payment.createdAt).getTime() + PIX_EXPIRATION_MINUTES * 60 * 1000))
    : null;
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
                <Text style={styles.copyCode} numberOfLines={2} ellipsizeMode="middle">{pixCopyPaste}</Text>
                <View style={styles.copyIconWrap}>
                  <Ionicons name={copied ? 'checkmark' : 'copy'} size={20} color={copied ? colors.success : colors.primary} />
                </View>
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
            <Ionicons name="information-circle" size={18} color={colors.textMuted} style={styles.instructionIcon} />
            <Text style={styles.instructionText}>
              Abra o app do seu banco, escolha PIX e selecione Ler QR Code ou Copia e Cola. O pagamento é confirmado na hora.
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

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
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
    borderRadius: borderRadius.sm, padding: spacing.sm, width: '100%', gap: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  copyIconWrap: {
    minWidth: 28, alignItems: 'center', justifyContent: 'center',
  },
  copyCode: { flex: 1, fontSize: 12, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', minWidth: 0 },
  copiedText: { fontSize: 12, color: colors.success, marginTop: spacing.xs },
  copyButton: {
    marginTop: spacing.sm,
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 16,
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
    borderRadius: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  bankButtonText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  instructionRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md,
    backgroundColor: colors.primaryLight, borderRadius: borderRadius.sm, padding: spacing.sm,
  },
  instructionIcon: { marginTop: 2 },
  instructionText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18, minWidth: 0 },
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
}
