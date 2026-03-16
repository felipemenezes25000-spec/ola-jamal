/**
 * SoapNotesCard — Exibe as notas SOAP geradas pela IA pós-consulta.
 * Seções: Subjetivo (S) · Objetivo (O) · Avaliação (A) · Plano (P)
 * + lista de termos médicos extraídos (condições, medicamentos, exames).
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/theme';

interface MedicalTerm {
  term: string;
  category: 'condition' | 'medication' | 'procedure' | 'exam' | string;
  icd_code?: string | null;
}

interface SoapData {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  medical_terms?: MedicalTerm[];
}

interface Props {
  soapJson: string | null | undefined;
}

function parseSoap(json: string | null | undefined): SoapData | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object') return parsed as SoapData;
    return null;
  } catch {
    return null;
  }
}

const TABS: { key: keyof SoapData; label: string; short: string }[] = [
  { key: 'subjective', label: 'Subjetivo', short: 'S' },
  { key: 'objective',  label: 'Objetivo',  short: 'O' },
  { key: 'assessment', label: 'Avaliação', short: 'A' },
  { key: 'plan',       label: 'Plano',     short: 'P' },
];

const _CATEGORY_LABEL: Record<string, string> = {
  condition: 'Condição',
  medication: 'Medicamento',
  procedure: 'Procedimento',
  exam: 'Exame',
};

const CATEGORY_COLOR: Record<string, { bg: string; text: string }> = {
  condition:  { bg: '#FEF3C7', text: '#92400E' },
  medication: { bg: '#DBEAFE', text: '#1E40AF' },
  procedure:  { bg: '#F3E8FF', text: '#6B21A8' },
  exam:       { bg: '#D1FAE5', text: '#065F46' },
};

export function SoapNotesCard({ soapJson }: Props) {
  const soap = useMemo(() => parseSoap(soapJson), [soapJson]);
  const [activeTab, setActiveTab] = useState<keyof SoapData>('subjective');

  const copyAll = useCallback(async () => {
    if (!soap) return;
    const text = TABS
      .map(t => `[${t.short}] ${t.label.toUpperCase()}\n${(soap[t.key] as string) || '—'}`)
      .join('\n\n');
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado', 'Notas SOAP copiadas para a área de transferência.');
  }, [soap]);

  const copySection = useCallback(async (key: keyof SoapData) => {
    if (!soap) return;
    const text = (soap[key] as string) || '—';
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado', 'Seção copiada.');
  }, [soap]);

  if (!soap) return null;

  const activeContent = (soap[activeTab] as string) || '';
  const terms = soap.medical_terms ?? [];

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          <Text style={s.title}>Notas SOAP</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>IA</Text>
          </View>
        </View>
        <Pressable onPress={copyAll} style={s.copyBtn} hitSlop={8}>
          <Ionicons name="copy-outline" size={16} color={colors.primary} />
          <Text style={s.copyBtnText}>Copiar tudo</Text>
        </Pressable>
      </View>

      {/* Tabs S/O/A/P */}
      <View style={s.tabs}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[s.tabShort, activeTab === tab.key && s.tabShortActive]}>
              {tab.short}
            </Text>
            <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Conteúdo da aba ativa */}
      <View style={s.sectionBox}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>
            {TABS.find(t => t.key === activeTab)?.label}
          </Text>
          <Pressable onPress={() => copySection(activeTab)} hitSlop={8}>
            <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
        <Text style={s.sectionText}>
          {activeContent || 'Dados insuficientes no transcript.'}
        </Text>
      </View>

      {/* Termos médicos */}
      {terms.length > 0 && (
        <View style={s.termsSection}>
          <Text style={s.termsSectionTitle}>Termos médicos extraídos</Text>
          <View style={s.termsList}>
            {terms.map((t, i) => {
              const colors2 = CATEGORY_COLOR[t.category] ?? CATEGORY_COLOR.condition;
              return (
                <View key={i} style={[s.termChip, { backgroundColor: colors2.bg }]}>
                  <Text style={[s.termText, { color: colors2.text }]}>{t.term}</Text>
                  {t.icd_code && (
                    <Text style={[s.termIcd, { color: colors2.text }]}>{t.icd_code}</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface ?? '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border ?? '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border ?? '#E5E7EB',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  badge: {
    backgroundColor: colors.primaryLight ?? '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyBtnText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border ?? '#E5E7EB',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabShort: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
  tabShortActive: { color: colors.primary },
  tabLabel: { fontSize: 10, color: colors.textMuted },
  tabLabelActive: { color: colors.primary },
  sectionBox: { padding: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionText: { fontSize: 14, color: colors.text, lineHeight: 22 },
  termsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border ?? '#E5E7EB',
    padding: 16,
  },
  termsSectionTitle: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  termsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  termChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  termText: { fontSize: 12, fontWeight: '500' },
  termIcd: { fontSize: 10, opacity: 0.7 },
});
