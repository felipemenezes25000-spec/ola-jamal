/**
 * Doctor Request — Sub-sections extraídos do [id].tsx
 *
 * DetailsCard, MedicationsCard, ExamsCard, SymptomsCard, SignedDocumentCard
 * Extraídos para facilitar manutenção e reutilização.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { spacing, borderRadius, typography, doctorDS } from '../../lib/themeDoctor';
import { DoctorCard } from '../ui/DoctorCard';
import type { RequestResponseDto } from '../../types/database';

const pad = doctorDS.screenPaddingHorizontal;
const TYPE_LABELS: Record<string, string> = { prescription: 'RECEITA', exam: 'EXAME', consultation: 'CONSULTA' };

// ─── DetailsCard ─────────────────────────────────────────────────

export function DetailsCard({ request }: { request: RequestResponseDto }) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <DoctorCard style={s.cardMargin}>
      <View style={s.detailsGrid}>
        <View style={s.detailItem}>
          <Text style={s.detailItemLabel}>TIPO</Text>
          <View style={s.detailChip}>
            <Ionicons name={request.requestType === 'prescription' ? 'document-text' : request.requestType === 'exam' ? 'flask' : 'videocam'} size={14} color={colors.primary} />
            <Text style={s.detailChipText}>{TYPE_LABELS[request.requestType]}</Text>
          </View>
        </View>
        {request.prescriptionType && (
          <View style={s.detailItem}>
            <Text style={s.detailItemLabel}>MODALIDADE</Text>
            <View style={[s.detailChip, request.prescriptionType === 'controlado' && s.detailChipWarn, request.prescriptionType === 'azul' && s.detailChipInfo]}>
              {request.prescriptionType === 'controlado' && <Ionicons name="warning" size={13} color={colors.warning} />}
              <Text style={[s.detailChipText, request.prescriptionType === 'controlado' && { color: colors.warning }, request.prescriptionType === 'azul' && { color: colors.info }]}>
                {request.prescriptionType === 'simples' ? 'Simples' : request.prescriptionType === 'controlado' ? 'Controlada' : 'Azul'}
              </Text>
            </View>
          </View>
        )}
      </View>
    </DoctorCard>
  );
}

// ─── MedicationsCard ─────────────────────────────────────────────

export function MedicationsCard({ medications }: { medications: string[] | null }) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!medications || medications.length === 0) return null;
  return (
    <DoctorCard style={s.cardMargin}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconWrap, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="medical" size={16} color={colors.primary} />
        </View>
        <Text style={s.sectionLabel}>MEDICAMENTOS</Text>
        <View style={s.sectionCountBadge}><Text style={s.sectionCountText}>{medications.length}</Text></View>
      </View>
      {medications.map((m, i) => (
        <View key={`med-${i}-${m.slice(0, 20)}`} style={[s.medCard, i > 0 && s.medCardBorder]}>
          <View style={s.medIndex}><Text style={s.medIndexText}>{i + 1}</Text></View>
          <Text style={s.medCardText}>{m}</Text>
        </View>
      ))}
    </DoctorCard>
  );
}

// ─── ExamsCard ────────────────────────────────────────────────────

export function ExamsCard({ exams }: { exams: string[] | null }) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!exams || exams.length === 0) return null;
  return (
    <DoctorCard style={s.cardMargin}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconWrap, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="flask" size={16} color={colors.primary} />
        </View>
        <Text style={s.sectionLabel}>EXAMES SOLICITADOS</Text>
        <View style={s.sectionCountBadge}><Text style={s.sectionCountText}>{exams.length}</Text></View>
      </View>
      {exams.map((e, i) => (
        <View key={`exam-${i}-${e.slice(0, 20)}`} style={[s.medCard, i > 0 && s.medCardBorder]}>
          <View style={[s.medIndex, { backgroundColor: colors.accentSoft }]}>
            <Text style={[s.medIndexText, { color: colors.primaryDark }]}>{i + 1}</Text>
          </View>
          <Text style={s.medCardText}>{e}</Text>
        </View>
      ))}
    </DoctorCard>
  );
}

// ─── SymptomsCard ────────────────────────────────────────────────

export function SymptomsCard({ symptoms }: { symptoms: string | null }) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!symptoms) return null;
  return (
    <DoctorCard style={s.cardMargin}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconWrap, { backgroundColor: colors.warningLight }]}>
          <Ionicons name="chatbubble-ellipses" size={16} color={colors.warning} />
        </View>
        <Text style={s.sectionLabel}>SINTOMAS RELATADOS</Text>
      </View>
      <View style={s.symptomsBlock}><Text style={s.symptomsText}>{symptoms}</Text></View>
    </DoctorCard>
  );
}

// ─── SignedDocumentCard ──────────────────────────────────────────

export function SignedDocumentCard({ request }: { request: RequestResponseDto }) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!request.signedDocumentUrl) return null;

  return (
    <DoctorCard style={s.cardMargin}>
      <View style={s.sectionHeader}>
        <Ionicons name="document-text" size={18} color={colors.success} />
        <Text style={s.sectionTitle}>DOCUMENTO ASSINADO</Text>
      </View>
      <TouchableOpacity
        style={s.pdfBtn}
        onPress={async () => {
          try {
            await WebBrowser.openBrowserAsync(request.signedDocumentUrl!);
          } catch (e: unknown) {
            Alert.alert('Erro', (e as Error)?.message || 'Não foi possível abrir o documento.');
          }
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="open-outline" size={20} color={colors.primary} />
        <Text style={s.pdfBtnText}>Visualizar PDF Assinado</Text>
      </TouchableOpacity>
    </DoctorCard>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    cardMargin: { marginHorizontal: pad, marginTop: spacing.md },
    detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    detailItem: { minWidth: 80 },
    detailItemLabel: { fontSize: 12, fontFamily: typography.fontFamily.bold, color: colors.textMuted, marginBottom: 6, letterSpacing: 1 },
    detailChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
    detailChipWarn: { backgroundColor: colors.warningLight },
    detailChipInfo: { backgroundColor: colors.infoLight },
    detailChipText: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
    detailPrice: { fontSize: 20, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primary },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text, letterSpacing: 0.5 },
    sectionLabel: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', flex: 1, marginBottom: 2 },
    sectionIconWrap: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    sectionCountBadge: { backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    sectionCountText: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primary },
    medCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
    medCardBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
    medIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
    medIndexText: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primary },
    medCardText: { fontSize: 14, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: colors.text, flex: 1, lineHeight: 20 },
    symptomsBlock: { borderLeftWidth: 3, borderLeftColor: colors.warning, paddingLeft: 12, paddingVertical: 4, backgroundColor: colors.warningLight, borderRadius: 4 },
    symptomsText: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, lineHeight: 22, fontStyle: 'italic' },
    pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, borderRadius: borderRadius.md, padding: spacing.md },
    pdfBtnText: { fontSize: 14, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  });
}
