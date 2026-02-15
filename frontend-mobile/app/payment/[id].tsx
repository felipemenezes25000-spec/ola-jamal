import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-linking';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Loading } from '../../components/Loading';
import { fetchPayment, confirmPayment } from '../../lib/api';
import { PaymentResponseDto } from '../../types/database';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    load();
    // Poll for payment status every 5 seconds
    pollRef.current = setInterval(async () => {
      try {
        if (id) {
          const p = await fetchPayment(id);
          setPayment(p);
          if (p.status === 'approved' || p.paidAt) {
            clearInterval(pollRef.current!);
            Alert.alert('Pagamento Confirmado!', 'Seu pagamento foi aprovado.', [
              { text: 'OK', onPress: () => router.replace('/(patient)/requests') }
            ]);
          }
        }
      } catch {}
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  const load = async () => {
    try { if (id) setPayment(await fetchPayment(id)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCopy = () => {
    if (payment?.pixCopyPaste) {
      // Note: Clipboard API varies; using a simplified approach
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      Alert.alert('Copiado!', 'Código PIX copiado para a área de transferência.');
    }
  };

  // Dev helper: confirm payment manually
  const handleDevConfirm = async () => {
    if (!payment) return;
    try {
      await confirmPayment(payment.id);
      Alert.alert('Pagamento Confirmado (Dev)', 'Pagamento confirmado manualmente.', [
        { text: 'OK', onPress: () => router.replace('/(patient)/requests') }
      ]);
    } catch (e: any) { Alert.alert('Erro', e.message); }
  };

  if (loading) return <SafeAreaView style={styles.container}><Loading color={colors.primary} message="Carregando pagamento..." /></SafeAreaView>;
  if (!payment) return <SafeAreaView style={styles.container}><Text style={styles.err}>Pagamento não encontrado</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.primaryDark} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Pagamento PIX</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Amount */}
        <Card style={styles.amountCard}>
          <Text style={styles.amountLabel}>Valor</Text>
          <Text style={styles.amount}>R$ {payment.amount.toFixed(2)}</Text>
          <View style={[styles.statusBadge, payment.status === 'approved' ? styles.approvedBadge : styles.pendingBadge]}>
            <Text style={[styles.statusText, payment.status === 'approved' ? styles.approvedText : styles.pendingText]}>
              {payment.status === 'approved' ? 'Pago' : 'Aguardando'}
            </Text>
          </View>
        </Card>

        {/* QR Code area */}
        {payment.status !== 'approved' && (
          <>
            <Card style={styles.qrCard}>
              <View style={styles.qrPlaceholder}>
                {payment.pixQrCodeBase64 ? (
                  <Text style={styles.qrHint}>QR Code disponível no app do banco</Text>
                ) : (
                  <View style={styles.qrBox}>
                    <Ionicons name="qr-code" size={120} color={colors.gray300} />
                  </View>
                )}
              </View>
              <Text style={styles.qrInstruction}>Escaneie o QR Code ou copie o código abaixo</Text>
            </Card>

            {/* PIX Copy-paste */}
            {payment.pixCopyPaste && (
              <Card style={styles.pixCard}>
                <Text style={styles.pixLabel}>Código PIX Copia e Cola</Text>
                <View style={styles.pixCodeBox}>
                  <Text style={styles.pixCode} numberOfLines={3}>{payment.pixCopyPaste}</Text>
                </View>
                <Button
                  title={copied ? "Copiado!" : "Copiar Código"}
                  onPress={handleCopy}
                  variant={copied ? "secondary" : "outline"}
                  fullWidth
                  icon={<Ionicons name={copied ? "checkmark" : "copy"} size={18} color={copied ? colors.white : colors.primary} />}
                />
              </Card>
            )}

            <View style={styles.timerRow}>
              <Ionicons name="time-outline" size={16} color={colors.gray500} />
              <Text style={styles.timerText}>O pagamento expira em 30 minutos</Text>
            </View>

            {/* Dev confirm button */}
            <TouchableOpacity style={styles.devBtn} onPress={handleDevConfirm}>
              <Text style={styles.devBtnText}>🧪 Confirmar Pagamento (Teste)</Text>
            </TouchableOpacity>
          </>
        )}

        {payment.status === 'approved' && (
          <Card style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            <Text style={styles.successTitle}>Pagamento Confirmado!</Text>
            <Text style={styles.successDesc}>Sua solicitação está sendo processada.</Text>
            <Button title="Ver Solicitações" onPress={() => router.replace('/(patient)/requests')} fullWidth style={{ marginTop: spacing.lg }} />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { ...typography.h4, color: colors.primaryDarker },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  err: { ...typography.body, color: colors.error, textAlign: 'center', marginTop: 100 },
  amountCard: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.md },
  amountLabel: { ...typography.bodySmall, color: colors.gray500 },
  amount: { ...typography.h1, color: colors.primaryDark, marginVertical: spacing.xs },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: borderRadius.full },
  pendingBadge: { backgroundColor: colors.warningLight },
  approvedBadge: { backgroundColor: colors.successLight },
  statusText: { ...typography.caption, fontWeight: '600' },
  pendingText: { color: colors.warning },
  approvedText: { color: colors.success },
  qrCard: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.md },
  qrPlaceholder: { marginBottom: spacing.md },
  qrBox: { width: 180, height: 180, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.gray50, borderRadius: borderRadius.lg },
  qrHint: { ...typography.bodySmall, color: colors.gray500 },
  qrInstruction: { ...typography.bodySmall, color: colors.gray500, textAlign: 'center' },
  pixCard: { marginBottom: spacing.md },
  pixLabel: { ...typography.bodySmallMedium, color: colors.gray700, marginBottom: spacing.sm },
  pixCodeBox: { backgroundColor: colors.gray50, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  pixCode: { ...typography.caption, color: colors.gray600, fontFamily: 'monospace' },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: spacing.lg },
  timerText: { ...typography.bodySmall, color: colors.gray500 },
  devBtn: { alignItems: 'center', padding: spacing.md, backgroundColor: colors.warningLight, borderRadius: borderRadius.lg },
  devBtnText: { ...typography.bodySmallMedium, color: colors.warning },
  successCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  successTitle: { ...typography.h3, color: colors.success, marginTop: spacing.md },
  successDesc: { ...typography.bodySmall, color: colors.gray500, marginTop: spacing.xs },
});
