/**
 * ClinicalNotesModal — Modal de notas clínicas ao encerrar consulta.
 *
 * Médico pode adicionar diagnóstico, conduta e orientações antes de encerrar.
 * Botão "Pular" encerra sem notas. Botão "Encerrar" salva e navega ao resumo.
 */

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesignColors } from '../../../lib/designSystem';

interface ClinicalNotesModalProps {
  visible: boolean;
  colors: DesignColors;
  clinicalNotes: string;
  onChangeNotes: (text: string) => void;
  onSkip: () => void;
  onConfirm: () => void;
}

export const ClinicalNotesModal = React.memo(function ClinicalNotesModal({
  visible, colors, clinicalNotes, onChangeNotes, onSkip, onConfirm,
}: ClinicalNotesModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.overlay}>
        <View
          style={[S.card, { backgroundColor: colors.surface }]}
          accessibilityViewIsModal
          accessibilityRole="none"
        >
          <View style={S.head}>
            <Ionicons name="create-outline" size={22} color={colors.primary} importantForAccessibility="no" />
            <Text style={[S.title, { color: colors.text }]} accessibilityRole="header">Notas Clínicas</Text>
          </View>
          <Text style={[S.sub, { color: colors.textMuted }]}>
            Adicione observações finais antes de encerrar (opcional)
          </Text>
          <TextInput
            style={[S.input, {
              backgroundColor: colors.surface, color: colors.text,
              borderColor: colors.border,
            }]}
            placeholder="Diagnóstico, conduta, orientações..."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            value={clinicalNotes}
            onChangeText={onChangeNotes}
            autoFocus
            autoCapitalize="sentences"
            autoCorrect={true}
            returnKeyType="default"
            accessibilityLabel="Notas clínicas"
            accessibilityHint="Digite diagnóstico, conduta e orientações"
          />
          <View style={S.acts}>
            <TouchableOpacity
              style={[S.btnSec, { backgroundColor: colors.surfaceSecondary }]}
              onPress={onSkip}
              accessibilityRole="button"
              accessibilityLabel="Pular notas clínicas"
              accessibilityHint="Encerra a consulta sem adicionar notas"
            >
              <Text style={[S.btnSecT, { color: colors.textMuted }]}>Pular</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.btnPri, { backgroundColor: colors.primary }]}
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel="Encerrar consulta"
              accessibilityHint="Salva as notas clínicas e encerra a consulta"
            >
              <Text style={[S.btnPriT, { color: colors.white }]}>Encerrar Consulta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 13 },
  input: { borderRadius: 12, padding: 14, minHeight: 120, maxHeight: 200, fontSize: 14, lineHeight: 22, borderWidth: 1 },
  acts: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnSec: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnSecT: { fontWeight: '600', fontSize: 14 },
  btnPri: { flex: 2, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnPriT: { fontWeight: '700', fontSize: 14 },
});
