import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, doctorDS } from '../../lib/themeDoctor';
import { DoctorCard } from '../ui/DoctorCard';
import { PrimaryButton } from '../ui/PrimaryButton';

interface DoctorActionButtonsProps {
  canApprove: boolean;
  canReject: boolean;
  canSign: boolean;
  canAccept: boolean;
  canVideo: boolean;
  actionLoading: boolean;
  isPrescription: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSign: () => void;
  onAccept: () => void;
  onStartVideo: () => void;
  onNavigateEditor: () => void;

  showRejectForm: boolean;
  showSignForm: boolean;
  rejectionReason: string;
  certPassword: string;
  onRejectionReasonChange: (text: string) => void;
  onCertPasswordChange: (text: string) => void;
  onToggleRejectForm: () => void;
  onToggleSignForm: () => void;

  isInQueue: boolean;
}

export function DoctorActionButtons({
  canApprove,
  canReject,
  canSign,
  canAccept,
  canVideo,
  actionLoading,
  isPrescription,
  onApprove,
  onReject,
  onSign,
  onAccept,
  onStartVideo,
  onNavigateEditor,
  showRejectForm,
  showSignForm,
  rejectionReason,
  certPassword,
  onRejectionReasonChange,
  onCertPasswordChange,
  onToggleRejectForm,
  onToggleSignForm,
  isInQueue,
}: DoctorActionButtonsProps) {
  return (
    <>
      {showSignForm && (
        <DoctorCard style={[s.cardMargin, s.formCard]}>
          <View style={s.formHeader}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            <Text style={s.formTitle}>ASSINATURA DIGITAL</Text>
          </View>
          <Text style={s.formDesc}>Digite a senha do seu certificado A1 para assinar</Text>
          <TextInput
            style={s.formInput}
            placeholder="Senha do certificado"
            secureTextEntry
            value={certPassword}
            onChangeText={onCertPasswordChange}
            placeholderTextColor={colors.textMuted}
          />
          <View style={s.formBtns}>
            <TouchableOpacity style={s.cancelBtn} onPress={onToggleSignForm}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <PrimaryButton label="Assinar" onPress={onSign} loading={actionLoading} style={s.primaryBtnFlex} />
          </View>
        </DoctorCard>
      )}

      {showRejectForm && (
        <DoctorCard style={[s.cardMargin, s.formCard]}>
          <Text style={s.formTitle}>REJEIÇÃO</Text>
          <TextInput
            style={s.formTextArea}
            placeholder="Descreva o motivo da rejeição..."
            value={rejectionReason}
            onChangeText={onRejectionReasonChange}
            multiline
            textAlignVertical="top"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <View style={s.formBtns}>
            <TouchableOpacity style={s.cancelBtn} onPress={onToggleRejectForm}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <PrimaryButton
              label="Rejeitar"
              variant="danger"
              onPress={onReject}
              loading={actionLoading}
              style={s.primaryBtnFlex}
            />
          </View>
        </DoctorCard>
      )}

      {isInQueue && (
        <View style={s.queueHint}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={s.queueHintText}>Pedido na fila. Aprove para enviar ao pagamento ou rejeite informando o motivo.</Text>
        </View>
      )}

      {!showSignForm && !showRejectForm && (
        <View style={s.actions}>
          {canAccept && (
            <PrimaryButton label="Aceitar Consulta" onPress={onAccept} loading={actionLoading} style={s.actionBtnFull} />
          )}
          {canApprove && (
            <PrimaryButton label="Aprovar" onPress={onApprove} loading={actionLoading} style={s.actionBtnFull} />
          )}
          {canSign && isPrescription && (
            <PrimaryButton label="Visualizar e Assinar" showArrow onPress={onNavigateEditor} style={s.actionBtnFull} />
          )}
          {canSign && !isPrescription && (
            <PrimaryButton label="Assinar Digitalmente" onPress={onToggleSignForm} style={s.actionBtnFull} />
          )}
          {canVideo && (
            <PrimaryButton label="Iniciar Consulta" showArrow onPress={onStartVideo} style={s.actionBtnFull} />
          )}
          {canReject && (
            <PrimaryButton label="Rejeitar" variant="outline-danger" onPress={onToggleRejectForm} style={s.actionBtnFull} />
          )}
        </View>
      )}
    </>
  );
}

const pad = doctorDS.screenPaddingHorizontal;

const s = StyleSheet.create({
  cardMargin: { marginHorizontal: pad, marginTop: spacing.md },
  formCard: { borderWidth: 1, borderColor: colors.border },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  formTitle: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  formDesc: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, marginBottom: spacing.md },
  formInput: { backgroundColor: colors.background, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, height: 48, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, fontFamily: typography.fontFamily.regular },
  formTextArea: { backgroundColor: colors.background, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: 15, color: colors.text, minHeight: 100, borderWidth: 1, borderColor: colors.border, fontFamily: typography.fontFamily.regular },
  formBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.card, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { fontSize: 15, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.textSecondary },
  primaryBtnFlex: { flex: 1 },
  queueHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: pad, marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: borderRadius.card },
  queueHintText: { flex: 1, fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },
  actions: { marginHorizontal: pad, marginTop: doctorDS.sectionGap, gap: spacing.sm },
  actionBtnFull: { width: '100%' },
});
