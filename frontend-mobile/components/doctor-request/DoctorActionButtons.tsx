import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { DoctorCard } from '../ui/DoctorCard';
import { AppButton } from '../ui/AppButton';
import type { DesignColors } from '../../lib/designSystem';

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
  const { colors, typography, spacing, borderRadius } = useAppTheme();
  
  // Dynamic styles
  const styles = useMemo(() => makeStyles(colors, typography, spacing, borderRadius), [colors]);

  return (
    <>
      {/* --- FORMULÁRIO DE ASSINATURA --- */}
      {showSignForm && (
        <DoctorCard style={styles.formCard}>
          <View style={styles.formHeader}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formTitle}>Assinatura Digital ICP-Brasil</Text>
              <Text style={styles.formDesc}>Digite a senha do seu certificado A1 para concluir.</Text>
            </View>
          </View>
          
          <TextInput
            style={styles.input}
            placeholder="Senha do certificado"
            secureTextEntry
            value={certPassword}
            onChangeText={onCertPasswordChange}
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={certPassword.length > 0 ? onSign : undefined}
          />
          
          <View style={styles.btnRow}>
            <AppButton
              title="Cancelar"
              variant="outline"
              onPress={onToggleSignForm}
              style={{ flex: 1 }}
            />
            <AppButton
              title="Assinar Documento"
              variant="primary"
              icon="pencil"
              onPress={onSign}
              loading={actionLoading}
              disabled={certPassword.length === 0}
              style={{ flex: 1.5 }}
            />
          </View>
        </DoctorCard>
      )}

      {/* --- FORMULÁRIO DE REJEIÇÃO --- */}
      {showRejectForm && (
        <DoctorCard style={[styles.formCard, { borderColor: colors.error }]}>
          <View style={styles.formHeader}>
            <View style={[styles.iconWrap, { backgroundColor: colors.errorLight }]}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.formTitle, { color: colors.error }]}>Rejeitar Pedido</Text>
              <Text style={styles.formDesc}>O motivo será enviado ao paciente.</Text>
            </View>
          </View>
          
          <TextInput
            style={styles.textArea}
            placeholder="Motivo da rejeição (ex: foto ilegível)..."
            value={rejectionReason}
            onChangeText={onRejectionReasonChange}
            multiline
            textAlignVertical="top"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          
          <View style={styles.btnRow}>
            <AppButton
              title="Voltar"
              variant="outline"
              onPress={onToggleRejectForm}
              style={{ flex: 1 }}
            />
            <AppButton
              title="Confirmar Rejeição"
              variant="danger"
              icon="close-circle"
              onPress={onReject}
              loading={actionLoading}
              disabled={rejectionReason.trim().length === 0}
              style={{ flex: 1.5 }}
            />
          </View>
        </DoctorCard>
      )}

      {/* --- DICA DE FILA --- */}
      {isInQueue && !showSignForm && !showRejectForm && (
        <View style={styles.hintBox}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.hintText}>
            Pedido aguardando sua análise. Verifique os dados acima antes de decidir.
          </Text>
        </View>
      )}

      {/* --- BOTÕES DE AÇÃO PRINCIPAIS --- */}
      {!showSignForm && !showRejectForm && (
        <View style={styles.mainActions}>
          {/* 1. ACEITAR CONSULTA */}
          {canAccept && (
            <AppButton
              title="Aceitar Atendimento"
              variant="primary"
              size="lg"
              icon="videocam"
              onPress={onAccept}
              loading={actionLoading}
              pulse
              fullWidth
            />
          )}

          {/* 2. APROVAR */}
          {canApprove && (
            <AppButton
              title="Aprovar Solicitação"
              variant="primary"
              size="lg"
              icon="checkmark-circle"
              onPress={onApprove}
              loading={actionLoading}
              fullWidth
            />
          )}

          {/* 3. ASSINAR */}
          {canSign && (isPrescription || isExam) && (
            <AppButton
              title="Visualizar e Assinar"
              variant="primary"
              size="lg"
              icon="document-text"
              trailing={<Ionicons name="arrow-forward" size={20} color={colors.white} />}
              onPress={onNavigateEditor}
              loading={actionLoading}
              fullWidth
            />
          )}
          
          {/* 4. ASSINAR (Legado) */}
          {canSign && !isPrescription && !isExam && (
            <AppButton
              title="Assinar Digitalmente"
              variant="primary"
              size="lg"
              icon="pencil"
              onPress={onToggleSignForm}
              loading={actionLoading}
              fullWidth
            />
          )}

          {/* 5. VÍDEO (Pós-Aceite) - Use secondary (green) */}
          {canVideo && (
            <AppButton
              title="Entrar na Sala de Vídeo"
              variant="secondary"
              size="lg"
              icon="videocam"
              onPress={onStartVideo}
              pulse
              fullWidth
            />
          )}

          {/* 6. REJEITAR (Ghost/Destructive) */}
          {canReject && (
            <AppButton
              title="Rejeitar Pedido"
              variant="ghost" 
              size="md"
              icon="close-circle-outline"
              onPress={onToggleRejectForm}
              style={{ marginTop: 8 }}
              fullWidth
            />
          )}
        </View>
      )}
    </>
  );
}

function makeStyles(colors: DesignColors, typography: any, spacing: any, borderRadius: any) {
  return StyleSheet.create({
    cardMargin: {
      marginHorizontal: 20,
      marginTop: 16,
    },
    formCard: {
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 24,
      marginHorizontal: 20,
    },
    formHeader: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    formTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    formDesc: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    input: {
      height: 50,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: 16,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surfaceSecondary,
      marginBottom: 16,
    },
    textArea: {
      minHeight: 120,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surfaceSecondary,
      marginBottom: 16,
    },
    btnRow: {
      flexDirection: 'row',
      gap: 12,
    },
    hintBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.primarySoft,
      padding: 16,
      borderRadius: borderRadius.card,
      marginHorizontal: 20,
      marginTop: 24,
    },
    hintText: {
      flex: 1,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    mainActions: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 40, // Extra bottom padding for scroll
      gap: 12,
    },
  });
}
