/**
 * Tab Consultas — visão dedicada de consultas (ativas e histórico).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { doctorDS } from '../../lib/themeDoctor';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { useQueryClient } from '@tanstack/react-query';
import { useRequestsEvents } from '../../contexts/RequestsEventsContext';
import { useDoctorRequestsQuery, useInvalidateDoctorRequests } from '../../lib/hooks/useDoctorRequestsQuery';
import { cacheRequest } from '../doctor-request/[id]';
import RequestCard from '../../components/RequestCard';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { AppEmptyState } from '../../components/ui';
import { FadeIn } from '../../components/ui/FadeIn';
import { showToast } from '../../components/ui/Toast';
import { haptics } from '../../lib/haptics';
import type { RequestResponseDto } from '../../types/database';

const pad = doctorDS.screenPaddingHorizontal;

const DOCTOR_REQUESTS_STALE_MS = 10_000;

const ACTIVE_STATUSES = [
  'submitted', 'pending', 'searching_doctor', 'approved',
  'paid', 'consultation_ready', 'consultation_accepted', 'in_consultation',
];

function normStatus(s: string): string {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function isActiveConsultation(status: string): boolean {
  return ACTIVE_STATUSES.includes(normStatus(status));
}

type TabValue = 'active' | 'history';

export default function DoctorConsultations() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { colors } = useAppTheme({ role: 'doctor' });
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<TabValue>('active');
  const [refreshing, setRefreshing] = useState(false);

  const { subscribe, isConnected } = useRequestsEvents();
  const invalidateDoctorRequests = useInvalidateDoctorRequests();
  const { data: requests = [], isLoading, isError, refetch } = useDoctorRequestsQuery(isConnected);

  const queryClient = useQueryClient();
  useFocusEffect(useCallback(() => {
    const state = queryClient.getQueryState(['doctor-requests']);
    const age = Date.now() - (state?.dataUpdatedAt ?? 0);
    if (age > DOCTOR_REQUESTS_STALE_MS) refetch();
  }, [queryClient, refetch]));
  React.useEffect(() => {
    return subscribe(() => invalidateDoctorRequests());
  }, [subscribe, invalidateDoctorRequests]);

  const consultations = useMemo(
    () => requests.filter((r) => r.requestType === 'consultation'),
    [requests]
  );
  const active = useMemo(
    () => consultations.filter((r) => isActiveConsultation(r.status ?? '')),
    [consultations]
  );
  const history = useMemo(
    () => consultations.filter((r) => !isActiveConsultation(r.status ?? '')),
    [consultations]
  );
  const list = tab === 'active' ? active : history;

  const sortedList = useMemo(
    () => [...list].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [list]
  );

  const onRefresh = useCallback(async () => {
    haptics.light();
    setRefreshing(true);
    try {
      await refetch();
      showToast({ message: 'Consultas atualizadas', type: 'success' });
    } catch {
      showToast({ message: 'Erro ao atualizar', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleItemPress = useCallback(
    (item: RequestResponseDto) => {
      haptics.selection();
      cacheRequest(item);
      router.push(`/doctor-request/${item.id}`);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: RequestResponseDto }) => (
      <RequestCard
        request={item}
        onPress={() => handleItemPress(item)}
        showPatientName
        showRisk={false}
        suppressHorizontalMargin
      />
    ),
    [handleItemPress]
  );

  const keyExtractor = useCallback((item: RequestResponseDto) => item.id, []);
  const empty = !isLoading && list.length === 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Consultas</Text>
          {active.length > 0 && (
            <View style={styles.activeBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.activeBadgeText}>
                {active.length} {active.length === 1 ? 'ativa' : 'ativas'}
              </Text>
            </View>
          )}
        </View>

        {/* Tabs Ativas / Histórico */}
        <View style={styles.tabRow}>
          <Pressable
            onPress={() => { haptics.selection(); setTab('active'); }}
            style={[styles.tab, tab === 'active' && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, tab === 'active' && styles.tabLabelActive]}>
              Ativas ({active.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { haptics.selection(); setTab('history'); }}
            style={[styles.tab, tab === 'history' && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, tab === 'history' && styles.tabLabelActive]}>
              Histórico ({history.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── LISTA ── */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <SkeletonList count={6} />
        </View>
      ) : isError && list.length === 0 ? (
        <AppEmptyState
          icon="alert-circle-outline"
          title="Erro ao carregar"
          subtitle="Verifique sua conexão e tente novamente."
          actionLabel="Tentar novamente"
          onAction={() => refetch()}
        />
      ) : empty ? (
        <AppEmptyState
          icon="videocam-outline"
          title={tab === 'active' ? 'Nenhuma consulta ativa' : 'Nenhuma consulta no histórico'}
          subtitle={tab === 'active' ? 'Consultas agendadas aparecerão aqui.' : 'Consultas finalizadas aparecerão aqui.'}
        />
      ) : (
        <FadeIn visible duration={200} fromY={8} delay={30}>
          <FlatList
            data={sortedList}
            keyExtractor={keyExtractor}
            getItemLayout={(_: unknown, i: number) => ({ length: 98, offset: 98 * i, index: i })}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: listPadding }]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            showsVerticalScrollIndicator={false}
            windowSize={7}
            maxToRenderPerBatch={10}
            initialNumToRender={8}
            removeClippedSubviews={Platform.OS !== 'web'}
          />
        </FadeIn>
      )}
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      backgroundColor: colors.surface,
      paddingHorizontal: pad,
      paddingBottom: 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.successLight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 6,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    activeBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.success,
    },
    tabRow: {
      flexDirection: 'row',
      gap: 0,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    loadingWrap: {
      flex: 1,
      paddingHorizontal: pad,
      paddingTop: 16,
    },
    listContent: {
      paddingTop: 8,
      paddingHorizontal: pad,
    },
  });
}
