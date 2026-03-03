import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../lib/themeDoctor';
import { getPatientRequests } from '../../lib/api';
import type { RequestResponseDto } from '../../types/database';
import { DoctorHeader } from '../../components/ui/DoctorHeader';

function fmtDateTime(d: string): string {
  const dt = new Date(d);
  return `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export default function DoctorPatientClinicalSummary() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const id = Array.isArray(patientId) ? patientId[0] : patientId ?? '';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getPatientRequests(id);
      setRequests(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const consultations = useMemo(
    () =>
      requests
        .filter(r => r.requestType === 'consultation')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [requests]
  );

  const patientName = requests[0]?.patientName ?? 'Paciente';

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <DoctorHeader
        title="Resumo clínico"
        subtitle={patientName}
        onBack={() => router.back()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.introCard}>
          <Ionicons name="document-text" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>Histórico narrativo</Text>
            <Text style={styles.introText}>
              Visão contínua das consultas, focando em queixa, evolução, hipótese diagnóstica (CID)
              e conduta registrada pelo médico.
            </Text>
          </View>
        </View>

        {consultations.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhuma consulta encontrada</Text>
            <Text style={styles.emptySubtitle}>
              Quando este paciente realizar consultas, o resumo clínico aparecerá aqui.
            </Text>
          </View>
        )}

        {consultations.map((c, idx) => {
          let conduct = c.doctorConductNotes || '';
          const aiHint = c.aiConductSuggestion;

          return (
            <View key={c.id} style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <View style={styles.entryIconWrap}>
                  <Ionicons name="videocam" size={18} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryTitle}>Consulta {idx + 1}</Text>
                  <Text style={styles.entryDate}>{fmtDateTime(c.createdAt)}</Text>
                </View>
              </View>

              {c.symptoms && (
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Queixa e duração (paciente)</Text>
                  <Text style={styles.fieldValue}>{c.symptoms}</Text>
                </View>
              )}

              {conduct ? (
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Registro do médico (prontuário)</Text>
                  <Text style={styles.fieldValue}>{conduct}</Text>
                </View>
              ) : aiHint ? (
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Sugestão de conduta da IA (não editada)</Text>
                  <Text style={[styles.fieldValue, { color: colors.textSecondary }]}>
                    {aiHint}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 80,
    gap: spacing.md,
  },
  introCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  introTitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  introText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  entryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.text,
  },
  entryDate: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    marginTop: 2,
  },
  fieldBlock: {
    marginTop: spacing.xs,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    lineHeight: 21,
  },
});

