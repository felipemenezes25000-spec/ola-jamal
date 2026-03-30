import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, shadows } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { formatBRL } from '../../lib/utils/format';

interface PaymentMethodSelectionProps {
  amount: number;
  onSelectPix: () => void;
  onSelectCard: () => void;
  pixLoading?: boolean;
}

export function PaymentMethodSelection({
  amount,
  onSelectPix,
  onSelectCard,
  pixLoading = false,
}: PaymentMethodSelectionProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <>
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
          onPress={onSelectPix}
          disabled={pixLoading}
          activeOpacity={0.8}
        >
          <View style={styles.pixButtonContent}>
            <View style={styles.pixButtonIconWrap}>
              <Ionicons name="qr-code" size={20} color={colors.white} />
            </View>
            <Text style={styles.pixButtonText}>Pagar com PIX</Text>
          </View>
          {pixLoading && (
            <View style={styles.pixButtonOverlay} pointerEvents="none">
              <ActivityIndicator color={colors.white} />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cardButton} onPress={onSelectCard} activeOpacity={0.8}>
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
    </>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
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
      backgroundColor: colors.primarySoft,
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
      paddingHorizontal: spacing.xs,
      minHeight: 40,
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
    pixButtonIconWrap: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pixButtonOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    pixButtonText: { fontSize: 16, fontWeight: '700', color: colors.white },
    cardButton: {
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 26,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      width: '100%',
      backgroundColor: colors.surface,
    },
    cardButtonText: { fontSize: 16, fontWeight: '700', color: colors.primary },
    priceDivider: { height: 1, backgroundColor: colors.border, width: '100%', marginTop: spacing.lg, marginBottom: spacing.md },
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
    securityText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  });
}
