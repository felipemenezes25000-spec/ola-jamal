import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader, AppCard } from '../components/ui';
import { fetchMyPatientSummary } from '../lib/api-clinical';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { uiTokens } from '../lib/ui/tokens';
import { useRequireAuth } from '../hooks/useRequireAuth';

export default function AllergiesScreen() {
  useRequireAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [problemList, setProblemList] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const _summary = await fetchMyPatientSummary();
        if (cancelled) return;
        setProblemList([]);
        setAlerts([]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao carregar dados.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasData = problemList.length > 0 || alerts.length > 0;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Alergias e Condições" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : error ? (
          <AppCard style={styles.card}>
            <Text style={styles.errorText}>{error}</Text>
          </AppCard>
        ) : !hasData ? (
          <AppCard style={styles.card}>
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhuma alergia ou condição registrada</Text>
              <Text style={styles.emptySubtitle}>
                Essas informações são preenchidas pelo médico durante a consulta e aparecerão aqui automaticamente.
              </Text>
            </View>
          </AppCard>
        ) : (
          <>
            {alerts.length > 0 && (
              <AppCard style={styles.card}>
                <Text style={styles.sectionTitle}>Alertas</Text>
                {alerts.map((item, i) => (
                  <View key={i} style={styles.listItem}>
                    <Ionicons name="warning-outline" size={16} color={colors.warning} />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </AppCard>
            )}
            {problemList.length > 0 && (
              <AppCard style={styles.card}>
                <Text style={styles.sectionTitle}>Condições</Text>
                {problemList.map((item, i) => (
                  <View key={i} style={styles.listItem}>
                    <Ionicons name="ellipse" size={8} color={colors.primary} />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </AppCard>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
      paddingBottom: uiTokens.sectionGap * 3,
    },
    card: { padding: uiTokens.spacing.lg },
    loader: { marginTop: uiTokens.sectionGap * 2 },
    sectionTitle: {
      fontSize: 15,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontWeight: '600',
      color: colors.text,
      marginBottom: uiTokens.spacing.md,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: uiTokens.spacing.sm,
      paddingVertical: uiTokens.spacing.xs,
    },
    listText: {
      flex: 1,
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.text,
      lineHeight: 20,
    },
    emptyState: { alignItems: 'center', paddingVertical: uiTokens.sectionGap },
    emptyTitle: {
      fontSize: 16,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontWeight: '600',
      color: colors.text,
      marginTop: uiTokens.spacing.md,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textSecondary,
      marginTop: uiTokens.spacing.sm,
      textAlign: 'center',
      lineHeight: 20,
    },
    errorText: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.error,
      textAlign: 'center',
    },
  });
}
