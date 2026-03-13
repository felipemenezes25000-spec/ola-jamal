/**
 * Tab Consultas — visão dedicada de consultas (ativas e histórico).
 * Alinha com DoctorConsultations.tsx do web.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { useRequestsEvents } from '../../contexts/RequestsEventsContext';
import { useDoctorRequestsQuery, useInvalidateDoctorRequests } from '../../lib/hooks/useDoctorRequestsQuery';
import { cacheRequest } from '../doctor-request/[id]';
import RequestCard from '../../components/RequestCard';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { showToast } from '../../components/ui/Toast';
import { haptics } from '../../lib/haptics';
import type { RequestResponseDto } from '../../types/database';

const ACTIVE_STATUSES = [
  'submitted', 'pending', 'searching_doctor', 'approved_pending_payment',
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
  const { colors, gradients } = useAppTheme({ role: 'doctor' });
  const [tab, setTab] = useState<TabValue>('active');
  const [refreshing, setRefreshing] = useState(false);

  const { subscribe, isConnected } = useRequestsEvents();
  const invalidateDoctorRequests = useInvalidateDoctorRequests();
  const { data: requests = [], isLoading, refetch } = useDoctorRequestsQuery(isConnected);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));
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
    ({ item, index }: { item: RequestResponseDto; index: number }) => (
      <FadeIn key={item.id} visible duration={200} fromY={8} delay={index * 30} fill={false}>
        <RequestCard
          request={item}
          onPress={() => handleItemPress(item)}
          showPatientName
          showPrice={false}
          showRisk={false}
          suppressHorizontalMargin
        />
      </FadeIn>
    ),
    [handleItemPress]
  );

  const keyExtractor = useCallback((item: RequestResponseDto) => item.id, []);
  const headerPaddingTop = insets.top + 16;
  const empty = !isLoading && list.length === 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={gradients.doctorHeader as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: headerPaddingTop }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="videocam" size={22} color={colors.headerOverlayText} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.headerOverlayText }]}>Consultas</Text>
            <Text style={[styles.subtitle, { color: colors.headerOverlayTextMuted }]}>
              {active.length} {active.length === 1 ? 'consulta ativa' : 'consultas ativas'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.surface }]}>
        <Pressable
          onPress={() => { haptics.selection(); setTab('active'); }}
          style={[
            styles.tab,
            tab === 'active' ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <Text style={[styles.tabLabel, { color: tab === 'active' ? '#fff' : colors.textMuted }]}>
            Ativas ({active.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => { haptics.selection(); setTab('history'); }}
          style={[
            styles.tab,
            tab === 'history' ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <Text style={[styles.tabLabel, { color: tab === 'history' ? '#fff' : colors.textMuted }]}>
            Histórico ({history.length})
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <SkeletonList count={6} />
      ) : empty ? (
        <View style={[styles.empty, { backgroundColor: colors.surface }]}>
          <Ionicons name="videocam-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {tab === 'active' ? 'Nenhuma consulta ativa' : 'Nenhuma consulta no histórico'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 12,
  },
});
