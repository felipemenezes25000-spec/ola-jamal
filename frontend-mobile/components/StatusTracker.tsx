import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../lib/theme';
import { RequestType, RequestStatus } from '../types/database';

interface Step {
  key: string;
  label: string;
  statuses: RequestStatus[];
}

const PRESCRIPTION_STEPS: Step[] = [
  { key: 'submitted', label: 'Enviado', statuses: ['submitted'] },
  { key: 'analysis', label: 'Análise', statuses: ['analyzing'] },
  { key: 'review', label: 'Em Análise', statuses: ['in_review'] },
  { key: 'payment', label: 'Pagamento', statuses: ['approved_pending_payment', 'pending_payment'] },
  { key: 'signed', label: 'Assinado', statuses: ['paid', 'signed'] },
  { key: 'delivered', label: 'Entregue', statuses: ['delivered'] },
];

const CONSULTATION_STEPS: Step[] = [
  { key: 'searching', label: 'Buscando', statuses: ['searching_doctor'] },
  { key: 'ready', label: 'Consulta Pronta', statuses: ['consultation_ready'] },
  { key: 'payment', label: 'Pagamento', statuses: ['approved_pending_payment', 'pending_payment'] },
  { key: 'in_consultation', label: 'Em Consulta', statuses: ['paid', 'in_consultation'] },
  { key: 'finished', label: 'Finalizada', statuses: ['consultation_finished'] },
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

const DOT_SIZE = 20;
const LINE_WIDTH = 2;
const ROW_MIN_HEIGHT = 40;

export default function StatusTracker({ currentStatus, requestType }: Props) {
  const steps = requestType === 'consultation' ? CONSULTATION_STEPS : PRESCRIPTION_STEPS;

  if (currentStatus === 'rejected' || currentStatus === 'cancelled') {
    return (
      <View style={styles.rejectedContainer}>
        <Ionicons
          name={currentStatus === 'rejected' ? 'close-circle' : 'ban'}
          size={24}
          color={currentStatus === 'rejected' ? colors.error : colors.textMuted}
        />
        <Text style={[styles.rejectedText, { color: currentStatus === 'rejected' ? colors.error : colors.textMuted }]}>
          {currentStatus === 'rejected' ? 'Rejeitado' : 'Cancelado'}
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
        const isPending = index > currentIndex;
        const isLast = index === steps.length - 1;

        return (
          <View key={step.key} style={styles.row}>
            <View style={styles.leftColumn}>
              <View
                style={[
                  styles.dot,
                  isCompleted && styles.dotCompleted,
                  isCurrent && styles.dotCurrent,
                  isPending && styles.dotPending,
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : isCurrent ? (
                  <View style={styles.currentInner} />
                ) : null}
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    index < currentIndex ? styles.lineCompleted : styles.linePending,
                  ]}
                />
              )}
            </View>
            <View style={styles.labelWrap}>
              <Text
                style={[
                  styles.label,
                  isCompleted && styles.labelCompleted,
                  isCurrent && styles.labelCurrent,
                  isPending && styles.labelPending,
                ]}
              >
                {step.label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: ROW_MIN_HEIGHT,
  },
  leftColumn: {
    alignItems: 'center',
    width: 28,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dotCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  dotCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotPending: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  currentInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  line: {
    width: LINE_WIDTH,
    flex: 1,
    minHeight: 16,
    marginVertical: 2,
  },
  lineCompleted: {
    backgroundColor: colors.success,
  },
  linePending: {
    backgroundColor: colors.border,
  },
  labelWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
    paddingVertical: 4,
  },
  label: {
    fontSize: 14,
  },
  labelCompleted: {
    color: colors.success,
    fontWeight: '600',
  },
  labelCurrent: {
    color: colors.primary,
    fontWeight: '700',
  },
  labelPending: {
    color: colors.textMuted,
  },
  rejectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rejectedText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
