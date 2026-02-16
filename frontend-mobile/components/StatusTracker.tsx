import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../lib/theme';
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

        return (
          <React.Fragment key={step.key}>
            <View style={styles.stepContainer}>
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.circleCompleted,
                  isCurrent && styles.circleCurrent,
                  isPending && styles.circlePending,
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : isCurrent ? (
                  <View style={styles.currentDot} />
                ) : (
                  <View style={styles.pendingDot} />
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  isCompleted && styles.labelCompleted,
                  isCurrent && styles.labelCurrent,
                  isPending && styles.labelPending,
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.line,
                  index < currentIndex ? styles.lineCompleted : styles.linePending,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  stepContainer: {
    alignItems: 'center',
    flex: 0,
    minWidth: 50,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCompleted: {
    backgroundColor: colors.success,
  },
  circleCurrent: {
    backgroundColor: colors.primary,
  },
  circlePending: {
    backgroundColor: colors.border,
  },
  currentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 60,
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
  line: {
    height: 2,
    flex: 1,
    marginTop: 11,
    minWidth: 12,
  },
  lineCompleted: {
    backgroundColor: colors.success,
  },
  linePending: {
    backgroundColor: colors.border,
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
