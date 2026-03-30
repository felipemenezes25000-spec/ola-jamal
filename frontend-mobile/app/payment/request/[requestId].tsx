import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { nav } from '../../../lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ui/useAppTheme';
import type { DesignColors } from '../../../lib/designSystem';
import { fetchRequestById, createPayment } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/api-client';
import type { RequestResponseDto } from '../../../types/database';
import { SkeletonList } from '../../../components/ui/SkeletonLoader';
import { useRequestUpdated } from '../../../hooks/useRequestUpdated';
import { PaymentHeader } from '../../../components/payment/PaymentHeader';
import { PaymentMethodSelection } from '../../../components/payment/PaymentMethodSelection';

export default function PaymentRequestScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const rid = Array.isArray(requestId) ? requestId[0] : requestId;
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [pixLoading, setPixLoading] = useState(false);
  const pixInFlightRef = useRef(false);

  const loadRequest = React.useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    try {
      const data = await fetchRequestById(rid);
      setRequest(data);
    } catch (e: unknown) {
      Alert.alert('Erro', (e as Error)?.message || String(e) || 'Erro ao carregar solicitação');
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    if (!rid) {
      setLoading(false);
      return;
    }
    loadRequest();
  }, [rid, loadRequest]);

  useRequestUpdated(rid ?? undefined, loadRequest);

  const handleSelectPix = async () => {
    if (!rid || pixInFlightRef.current) return;
    pixInFlightRef.current = true;
    setPixLoading(true);
    try {
      const payment = await createPayment({ requestId: rid, paymentMethod: 'pix' });
      const targetUrl = `/payment/${payment.id}`;
      nav.replace(router, targetUrl as any);
    } catch (error: unknown) {
      const msg = getApiErrorMessage(error);
      if (msg?.toLowerCase().includes('já possui pagamento aprovado')) {
        Alert.alert(
          'Pagamento já confirmado',
          'Esta solicitação já tem um pagamento aprovado. Vamos te levar para o pedido para você acompanhar o documento.',
          [
            {
              text: 'Ver pedido',
              onPress: () => nav.replace(router, `/request-detail/${rid}`),
            },
          ]
        );
      } else {
        Alert.alert('Erro ao gerar pagamento', msg);
      }
    } finally {
      setPixLoading(false);
      pixInFlightRef.current = false;
    }
  };

  const handleSelectCard = () => {
    if (!rid) return;
    router.push({ pathname: '/payment/card', params: { requestId: rid } });
  };

  const amount: number = request?.price ?? 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <PaymentHeader onBack={() => router.back()} />
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <SkeletonList count={3} />
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={styles.container}>
        <PaymentHeader onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Solicitação não encontrada</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PaymentHeader onBack={() => router.back()} />
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PaymentMethodSelection
            amount={amount}
            onSelectPix={handleSelectPix}
            onSelectCard={handleSelectCard}
            pixLoading={pixLoading}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
    errorText: { fontSize: 16, color: colors.textSecondary },
  });
}
