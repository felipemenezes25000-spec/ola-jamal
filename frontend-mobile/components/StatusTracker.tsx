import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';
import { RequestType, RequestStatus } from '../types/database';
import { STATUS_LABELS_PT } from '../lib/domain/statusLabels';

const c = theme.colors;

interface Step {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  statuses: RequestStatus[];
}

const PRESCRIPTION_STEPS: Step[] = [
  { key: 'submitted', label: 'Enviado', icon: 'paper-plane-outline', statuses: ['submitted'] },
  { key: 'analysis', label: 'Análise IA', icon: 'scan-outline', statuses: ['analyzing'] },
  { key: 'review', label: STATUS_LABELS_PT.in_review, icon: 'eye-outline', statuses: ['in_review'] },
  { key: 'payment', label: 'Pagamento', icon: 'card-outline', statuses: ['approved_pending_payment', 'pending_payment'] },
  { key: 'signed', label: 'Assinado', icon: 'shield-checkmark-outline', statuses: ['paid', 'signed'] },
  { key: 'delivered', label: 'Entregue', icon: 'checkmark-done-circle-outline', statuses: ['delivered'] },
];

const CONSULTATION_STEPS: Step[] = [
  { key: 'searching', label: 'Buscando', icon: 'search-outline', statuses: ['searching_doctor'] },
  { key: 'ready', label: 'Pronta', icon: 'checkmark-circle-outline', statuses: ['consultation_ready'] },
  { key: 'payment', label: 'Pagamento', icon: 'card-outline', statuses: ['approved_pending_payment', 'pending_payment'] },
  { key: 'in_consultation', label: 'Em Consulta', icon: 'videocam-outline', statuses: ['paid', 'in_consultation'] },
  { key: 'finished', label: 'Finalizada', icon: 'checkmark-done-circle-outline', statuses: ['consultation_finished'] },
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
const COMPLETED_COLOR = '#10B981';
const CURRENT_COLOR = c.primary.main;
const PENDING_COLOR = c.border.main;

export default function StatusTracker({ currentStatus, requestType }: Props) {
  const steps = requestType === 'consultation' ? CONSULTATION_STEPS : PRESCRIPTION_STEPS;

  if (currentStatus === 'rejected' || currentStatus === 'cancelled') {
    const isRejected = currentStatus === 'rejected';
    return (
      <View style={styles.terminalContainer}>
        <View style={[styles.terminalCircle, { backgroundColor: isRejected ? c.status.errorLight : c.background.secondary }]}>
          <Ionicons
            name={isRejected ? 'close-circle' : 'ban'}
            size={28}
            color={isRejected ? c.status.error : c.text.tertiary}
          />
        </View>
        <Text style={[styles.terminalText, { color: isRejected ? c.status.error : c.text.tertiary }]}>
          {isRejected ? 'SOLICITAÇÃO REJEITADA' : 'SOLICITAÇÃO CANCELADA'}
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
        const textColor = isCompleted ? COMPLETED_COLOR : isCurrent ? CURRENT_COLOR : c.text.tertiary;
        const textWeight = isCurrent ? '700' : isCompleted ? '600' : '400';

        return (
          <View key={step.key} style={styles.row}>
            {/* Dot column */}
            <View style={styles.dotColumn}>
              <View style={[styles.dot, { borderColor: dotColor, backgroundColor: dotBg }]}>
                {isCompleted ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Ionicons name={step.icon} size={12} color={isCurrent ? '#fff' : c.text.tertiary} />
                )}
              </View>
              {!isLast && (
                <View style={[styles.line, { backgroundColor: lineColor }]} />
              )}
            </View>

            {/* Label */}
            <View style={styles.labelWrap}>
              <Text style={[styles.label, { color: textColor, fontWeight: textWeight as any }]}>
                {step.label}
              </Text>
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <View style={styles.pulsingDot} />
                  <Text style={styles.currentText}>ETAPA ATUAL</Text>
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
    backgroundColor: c.primary.main,
  },
  currentText: {
    fontSize: 10,
    fontWeight: '700',
    color: c.primary.main,
    letterSpacing: 0.8,
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
    letterSpacing: 0.5,
  },
});
