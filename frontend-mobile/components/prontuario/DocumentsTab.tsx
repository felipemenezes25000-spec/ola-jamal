/**
 * DocumentsTab — Receitas e exames com filtros e agrupamento por data.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { spacing, typography } from '../../lib/themeDoctor';
import type { RequestResponseDto } from '../../types/database';
import { AppSegmentedControl, AppEmptyState } from '../ui';
import { formatDateTimeBR, formatDateBR } from '../../lib/utils/format';
import { getStatusLabelPt } from '../../lib/domain/statusLabels';

const TYPE_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'prescription', label: 'Receitas' },
  { key: 'exam', label: 'Exames' },
] as const;

type TypeFilter = (typeof TYPE_FILTERS)[number]['key'];

interface DocumentsTabProps {
  prescriptions: RequestResponseDto[];
  exams: RequestResponseDto[];
}

function normalizeDateLabel(d: string): string {
  return formatDateBR(d, { short: true });
}

function getStatusColor(status: string | null | undefined, colors: DesignColors): string {
  const key = (status ?? '').toLowerCase();
  if (key === 'delivered' || key === 'signed') return colors.success;
  if (key === 'paid') return colors.info;
  if (key === 'rejected' || key === 'cancelled') return colors.error;
  return colors.textMuted;
}

export function DocumentsTab({ prescriptions, exams }: DocumentsTabProps) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const S = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allDocs = useMemo(() => {
    const docs = [...prescriptions, ...exams];
    return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [prescriptions, exams]);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return allDocs;
    return allDocs.filter((d) => d.requestType === typeFilter);
  }, [allDocs, typeFilter]);

  const grouped = useMemo(() => {
    const groups: { dateLabel: string; items: RequestResponseDto[] }[] = [];
    const index = new Map<string, number>();

    filtered.forEach((req) => {
      const label = normalizeDateLabel(req.createdAt);
      const existing = index.get(label);
      if (existing == null) {
        index.set(label, groups.length);
        groups.push({ dateLabel: label, items: [req] });
      } else {
        groups[existing].items.push(req);
      }
    });

    return groups;
  }, [filtered]);

  const counts = useMemo(() => ({
    all: allDocs.length,
    prescription: prescriptions.length,
    exam: exams.length,
  }), [allDocs, prescriptions, exams]);

  if (allDocs.length === 0) {
    return (
      <AppEmptyState
        icon="document-text-outline"
        title="Nenhum documento"
        subtitle="Receitas e exames do paciente aparecerão aqui quando houver solicitações."
      />
    );
  }

  return (
    <View style={S.container}>
      <AppSegmentedControl
        items={TYPE_FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          count: counts[f.key],
        }))}
        value={typeFilter}
        onValueChange={(v) => setTypeFilter(v as TypeFilter)}
        size="sm"
      />

      {filtered.length === 0 && (
        <AppEmptyState
          icon="filter"
          title="Nenhum resultado"
          subtitle="Ajuste o filtro para ver outros documentos."
        />
      )}

      {grouped.map((group) => (
        <View key={group.dateLabel} style={S.dateGroup}>
          <Text style={S.dateGroupTitle}>{group.dateLabel}</Text>
          <View style={S.dateGroupList}>
            {group.items.map((req, idx) => {
              const isPrescription = req.requestType === 'prescription';
              const isExpanded = expandedId === req.id;
              const statusLabel = getStatusLabelPt((req.status ?? '').toLowerCase());
              const statusColor = getStatusColor(req.status, colors);
              const typeLabel = isPrescription ? 'Receita' : 'Exame';
              const typeIcon = isPrescription ? 'document-text' : 'flask';
              const typeColor = isPrescription ? colors.primary : colors.info;
              const items = isPrescription ? (req.medications ?? []) : (req.exams ?? []);
              const typeModality = isPrescription && req.prescriptionType
                ? (req.prescriptionType === 'controlado' ? ' · Controlada' : req.prescriptionType === 'azul' ? ' · Azul' : ' · Simples')
                : '';

              return (
                <View key={req.id} style={[S.docCard, idx < group.items.length - 1 && S.docCardBorder]}>
                  <Pressable
                    style={S.docHeader}
                    onPress={() => setExpandedId(isExpanded ? null : req.id)}
                  >
                    <View style={[S.docIconWrap, { backgroundColor: typeColor + '14' }]}>
                      <Ionicons name={typeIcon} size={16} color={typeColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.docType}>{typeLabel}{typeModality}</Text>
                      <Text style={S.docMeta}>
                        {formatDateTimeBR(req.createdAt).split(' ')[1]}
                        {items.length > 0 ? ` · ${items.length} item(ns)` : ''}
                      </Text>
                    </View>
                    <View style={S.statusInline}>
                      <View style={[S.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[S.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>

                  {/* Quick items preview */}
                  {items.length > 0 && !isExpanded && (
                    <Text style={S.itemsPreview} numberOfLines={1}>
                      {items.join(', ')}
                    </Text>
                  )}

                  {/* Expanded */}
                  {isExpanded && (
                    <View style={S.expandedContent}>
                      {items.length > 0 && (
                        <View style={S.itemsList}>
                          <Text style={S.itemsLabel}>{isPrescription ? 'Medicamentos' : 'Exames solicitados'}</Text>
                          {items.map((item, i) => (
                            <View key={i} style={S.itemRow}>
                              <View style={[S.itemBullet, { backgroundColor: typeColor + '20' }]}>
                                <Text style={[S.itemBulletText, { color: typeColor }]}>{i + 1}</Text>
                              </View>
                              <Text style={S.itemText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {req.symptoms && (
                        <View style={S.fieldBlock}>
                          <Text style={S.fieldLabel}>Queixa / Sintomas</Text>
                          <Text style={S.fieldValue}>{req.symptoms}</Text>
                        </View>
                      )}

                      {req.notes && (
                        <View style={S.fieldBlock}>
                          <Text style={S.fieldLabel}>Observações</Text>
                          <Text style={S.fieldValue}>{req.notes}</Text>
                        </View>
                      )}

                      {req.aiSummaryForDoctor && (
                        <View style={S.fieldBlock}>
                          <Text style={S.fieldLabel}>Análise da IA</Text>
                          <Text style={[S.fieldValue, { color: colors.textSecondary }]}>{req.aiSummaryForDoctor}</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={S.detailLink}
                        onPress={() => router.push(`/doctor-request/${req.id}` as never)}
                        activeOpacity={0.7}
                      >
                        <Text style={S.detailLinkText}>Ver pedido completo</Text>
                        <Ionicons name="open-outline" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: { gap: spacing.md },
    dateGroup: { marginBottom: spacing.xs },
    dateGroupTitle: {
      fontSize: 13,
      fontFamily: typography.fontFamily.semibold,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 8,
    },
    dateGroupList: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
    },
    docCard: {
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    docCardBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    docHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    docIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    docType: {
      fontSize: 15,
      fontFamily: typography.fontFamily.semibold,
      fontWeight: '600',
      color: colors.text,
    },
    docMeta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    statusInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginRight: 4,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontFamily: typography.fontFamily.medium,
      fontWeight: '500',
    },
    itemsPreview: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 6,
      paddingLeft: 44,
    },
    expandedContent: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    itemsList: {
      marginBottom: spacing.sm,
    },
    itemsLabel: {
      fontSize: 11,
      fontFamily: typography.fontFamily.bold,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    itemBullet: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemBulletText: {
      fontSize: 11,
      fontFamily: typography.fontFamily.bold,
      fontWeight: '700',
    },
    itemText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
      lineHeight: 20,
    },
    fieldBlock: {
      marginBottom: spacing.sm,
    },
    fieldLabel: {
      fontSize: 11,
      fontFamily: typography.fontFamily.bold,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    fieldValue: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 21,
    },
    detailLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    detailLinkText: {
      fontSize: 13,
      fontFamily: typography.fontFamily.semibold,
      color: colors.primary,
    },
  });
}
