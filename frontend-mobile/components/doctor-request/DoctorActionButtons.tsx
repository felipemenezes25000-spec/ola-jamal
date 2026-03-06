import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, doctorDS } from '../../lib/themeDoctor';
import { DoctorCard } from '../ui/DoctorCard';
import { AppButton } from '../ui/AppButton';

interface DoctorActionButtonsProps {
  canApprove: boolean;
  canReject: boolean;
  canSign: boolean;
  canAccept: boolean;
  canVideo: boolean;
  actionLoading: boolean;
  isPrescription: boolean;
  isExam?: boolean;
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
  isExam = false,
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
            <View style={s.formIconWrap}>
              <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.formTitle}>Assinatura digital</Text>
              <Text style={s.formDesc}>Digite a senha do seu certificado A1 para assinar digitalmente</Text>
            </View>
          </View>
          <TextInput
            style={s.formInput}
            placeholder="Senha do certificado"
            secureTextEntry
            value={certPassword}
            onChangeText={onCertPasswordChange}
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={certPassword.length > 0 ? onSign : undefined}
            accessibilityLabel="Senha do certificado digital"
            accessibilityHint="Confirme com o botão Assinar"
          />
          <View style={s.formBtns}>
            <AppButton
              title="Cancelar"
              variant="doctorOutline"
              onPress={onToggleSignForm}
              style={s.primaryBtnFlex}
            />
            <AppButton
              title="Assinar"
              variant="doctorPrimary"
              onPress={onSign}
              loading={actionLoading}
              disabled={certPassword.length === 0 || actionLoading}
              style={s.primaryBtnFlex}
            />
          </View>
        </DoctorCard>
      )}

      {showRejectForm && (
        <DoctorCard style={[s.cardMargin, s.formCard]}>
          <View style={s.formHeader}>
            <View style={[s.formIconWrap, s.formIconWrapDanger]}>
              <Ionicons name="close-circle" size={18} color={colors.destructive} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.formTitle, s.formTitleDanger]}>Rejeitar pedido</Text>
              <Text style={s.formDesc}>Informe o motivo para que o paciente possa corrigir</Text>
            </View>
          </View>
          <TextInput
            style={s.formTextArea}
            placeholder="Descreva o motivo da rejeição..."
            value={rejectionReason}
            onChangeText={onRejectionReasonChange}
            multiline
            textAlignVertical="top"
            placeholderTextColor={colors.textMuted}
            autoFocus
            accessibilityLabel="Motivo da rejeição"
            accessibilityHint="Explique por que o pedido está sendo rejeitado"
          />
          <View style={s.formBtns}>
            <AppButton
              title="Cancelar"
              variant="doctorOutline"
              onPress={onToggleRejectForm}
              style={s.primaryBtnFlex}
            />
            <AppButton
              title="Rejeitar"
              variant="doctorDanger"
              onPress={onReject}
              loading={actionLoading}
              disabled={rejectionReason.trim().length === 0 || actionLoading}
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
            <AppButton title="Aceitar Consulta" variant="doctorPrimary" onPress={onAccept} loading={actionLoading} style={s.actionBtnFull} />
          )}
          {canApprove && (
            <AppButton title="Aprovar" variant="doctorPrimary" onPress={onApprove} loading={actionLoading} style={s.actionBtnFull} />
          )}
          {canSign && (isPrescription || isExam) && (
            <AppButton
              title="Visualizar e Assinar"
              variant="doctorPrimary"
              trailing={<Ionicons name="chevron-forward" size={20} color={colors.white} />}
              onPress={onNavigateEditor}
              style={s.actionBtnFull}
            />
          )}
          {canSign && !isPrescription && !isExam && (
            <AppButton title="Assinar Digitalmente" variant="doctorPrimary" onPress={onToggleSignForm} style={s.actionBtnFull} />
          )}
          {canVideo && (
            <AppButton
              title="Iniciar Consulta"
              variant="doctorPrimary"
              trailing={<Ionicons name="chevron-forward" size={20} color={colors.white} />}
              onPress={onStartVideo}
              style={s.actionBtnFull}
            />
          )}
          {canReject && (
            <AppButton title="Rejeitar" variant="doctorOutlineDanger" onPress={onToggleRejectForm} style={s.actionBtnFull} />
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
  formHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  formIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  formIconWrapDanger: { backgroundColor: colors.errorLight },
  formTitle: {
    fontSize: 15, fontFamily: typography.fontFamily.bold, fontWeight: '700',
    color: colors.text, marginBottom: 2,
  },
  formTitleDanger: { color: colors.destructive },
  formDesc: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, lineHeight: 18 },
  formInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md, height: 48, fontSize: 15, color: colors.text,
    borderWidth: 1, borderColor: colors.border, fontFamily: typography.fontFamily.regular,
  },
  formTextArea: {
    backgroundColor: colors.background, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: 15, color: colors.text,
    minHeight: 100, borderWidth: 1, borderColor: colors.border,
    fontFamily: typography.fontFamily.regular,
  },
  formBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primaryBtnFlex: { flex: 1 },
  queueHint: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: pad, marginTop: spacing.lg, padding: spacing.md,
    backgroundColor: colors.primarySoft, borderRadius: borderRadius.card,
  },
  queueHintText: { flex: 1, fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },
  actions: { marginHorizontal: pad, marginTop: doctorDS.sectionGap, gap: spacing.sm },
  actionBtnFull: { width: '100%' },
});
