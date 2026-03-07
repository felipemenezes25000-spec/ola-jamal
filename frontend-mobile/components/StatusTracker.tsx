import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../lib/ui/useAppTheme';
import { RequestType, RequestStatus } from '../types/database';
import { STATUS_LABELS_PT } from '../lib/domain/statusLabels';

interface Step {
  key: string;
  label: string;
  shortLabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  statuses: RequestStatus[];
}

const PRESCRIPTION_STEPS: Step[] = [
  { key: 'submitted', label: 'Enviado', shortLabel: 'Enviado', icon: 'paper-plane-outline', statuses: ['submitted'] },
  { key: 'review', label: STATUS_LABELS_PT.in_review, shortLabel: 'Em análise', icon: 'eye-outline', statuses: ['analyzing', 'in_review'] },
  { key: 'waiting_payment', label: 'Aguardando pagamento', shortLabel: 'Pag. pendente', icon: 'card-outline', statuses: ['approved_pending_payment', 'pending_payment'] },
  { key: 'paid', label: 'Pago', shortLabel: 'Pago', icon: 'wallet-outline', statuses: ['paid'] },
  { key: 'signed', label: 'Assinado', shortLabel: 'Assinado', icon: 'shield-checkmark-outline', statuses: ['signed'] },
  { key: 'delivered', label: 'Entregue', shortLabel: 'Entregue', icon: 'checkmark-done-circle-outline', statuses: ['delivered', 'completed'] },
];

const CONSULTATION_STEPS: Step[] = [
  { key: 'searching', label: 'Buscando médico', shortLabel: 'Buscando', icon: 'search-outline', statuses: ['searching_doctor'] },
  { key: 'payment', label: 'Aguardando pagamento', shortLabel: 'Pag. pendente', icon: 'card-outline', statuses: ['approved_pending_payment', 'pending_payment'] },
  { key: 'ready', label: 'Consulta pronta', shortLabel: 'Pronta', icon: 'checkmark-circle-outline', statuses: ['paid'] },
  { key: 'in_consultation', label: 'Em consulta', shortLabel: 'Em consulta', icon: 'videocam-outline', statuses: ['in_consultation'] },
  { key: 'finished', label: 'Finalizada', shortLabel: 'Finalizada', icon: 'checkmark-done-circle-outline', statuses: ['consultation_finished'] },
];

function getStepIndex(steps: Step[], status: RequestStatus): number {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].statuses.includes(status)) return i;
  }
  return 0;
}

interface Props {
  currentStatus: RequestStatus;
  requestType: RequestType;
}

const DOT_SIZE = 26;
const LINE_W = 2.5;

export default function StatusTracker({ currentStatus, requestType }: Props) {
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  
  const isCompact = width < 360;
  const steps = requestType === 'consultation' ? CONSULTATION_STEPS : PRESCRIPTION_STEPS;

  const COMPLETED_COLOR = colors.success;
  const CURRENT_COLOR = colors.primary;
  const PENDING_COLOR = colors.border;

  if (currentStatus === 'rejected' || currentStatus === 'cancelled') {
    const isRejected = currentStatus === 'rejected';
    return (
      <View style={styles.terminalContainer}>
        <View style={[styles.terminalCircle, { backgroundColor: isRejected ? colors.errorLight : colors.surfaceSecondary }]}>
          <Ionicons
            name={isRejected ? 'close-circle' : 'ban'}
            size={28}
            color={isRejected ? colors.error : colors.textMuted}
          />
        </View>
        <Text style={[styles.terminalText, { color: isRejected ? colors.error : colors.textMuted }]}>
          {isRejected ? 'Solicitação rejeitada' : 'Solicitação cancelada'}
        </Text>
      </View>
    );
  }

  const currentIndex = getStepIndex(steps, currentStatus);

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === steps.length - 1;

        const dotColor = isCompleted ? COMPLETED_COLOR : isCurrent ? CURRENT_COLOR : PENDING_COLOR;
        const dotBg = isCompleted ? COMPLETED_COLOR : isCurrent ? CURRENT_COLOR : 'transparent';
        const lineColor = index < currentIndex ? COMPLETED_COLOR : PENDING_COLOR;
        const textColor = isCompleted ? COMPLETED_COLOR : isCurrent ? CURRENT_COLOR : colors.textMuted;
        const textWeight = isCurrent ? '700' : isCompleted ? '600' : '400';

        return (
          <View key={step.key} style={styles.row}>
            {/* Dot column */}
            <View style={styles.dotColumn}>
              <View style={[styles.dot, { borderColor: dotColor, backgroundColor: dotBg }]}>
                {isCompleted ? (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                ) : (
                  <Ionicons name={step.icon} size={12} color={isCurrent ? colors.white : colors.textMuted} />
                )}
              </View>
              {!isLast && (
                <View style={[styles.line, { backgroundColor: lineColor }]} />
              )}
            </View>

            {/* Label */}
            <View style={styles.labelWrap}>
              <Text style={[styles.label, { color: textColor, fontWeight: textWeight as any }]}>
                {isCompact ? (step.shortLabel ?? step.label) : step.label}
              </Text>
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <View style={[styles.pulsingDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.currentText, { color: colors.primary }]}>Etapa atual</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 48,
  },
  dotColumn: {
    alignItems: 'center',
    width: 36,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: LINE_W,
    flex: 1,
    minHeight: 18,
    marginVertical: 2,
    borderRadius: LINE_W / 2,
  },
  labelWrap: {
    flex: 1,
    paddingLeft: 12,
    paddingTop: 3,
    paddingBottom: 8,
  },
  label: {
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  currentText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  terminalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  terminalCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
