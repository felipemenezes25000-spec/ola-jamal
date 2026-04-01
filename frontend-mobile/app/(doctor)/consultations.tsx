/**
 * Tab Consultas — visão dedicada de consultas (ativas e histórico).
 * Redesigned: responsive 320-768px, segmented tabs, custom consultation cards.
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
import { Ionicons } from '@expo/vector-icons';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { doctorDS } from '../../lib/themeDoctor';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors, DesignTokens } from '../../lib/designSystem';
import { useQueryClient } from '@tanstack/react-query';
import { useRequestsEvents } from '../../contexts/RequestsEventsContext';
import { useDoctorRequestsQuery, useInvalidateDoctorRequests } from '../../lib/hooks/useDoctorRequestsQuery';
import { cacheRequest } from '../doctor-request/[id]';
import { StatusBadge } from '../../components/StatusBadge';
import { AppSegmentedControl, AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { showToast } from '../../components/ui/Toast';
import { haptics } from '../../lib/haptics';
import { motionTokens } from '../../lib/ui/motion';
import { formatDateBR, formatTimeBR } from '../../lib/utils/format';
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

/** Statuses that allow joining the video call */
const JOINABLE_STATUSES = [
  'consultation_ready', 'consultation_accepted', 'in_consultation',
];

function isJoinable(status: string): boolean {
  return JOINABLE_STATUSES.includes(normStatus(status));
}

type TabValue = 'active' | 'history';

const TAB_ITEMS = [
  { key: 'active', label: 'Ativas' },
  { key: 'history', label: 'Histórico' },
];

// ── Consultation Card (inline) ──────────────────────────────────
interface ConsultationCardProps {
  item: RequestResponseDto;
  onPress: () => void;
  colors: DesignColors;
  shadows: DesignTokens['shadows'];
}

const ConsultationCardInner = React.memo(function ConsultationCardInner({
  item,
  onPress,
  colors,
  shadows,
}: ConsultationCardProps) {
  const styles = useMemo(() => makeCardStyles(colors, shadows), [colors, shadows]);
  const joinable = isJoinable(item.status ?? '');
  const dateStr = formatDateBR(item.createdAt, { short: true });
  const timeStr = formatTimeBR(item.createdAt);

  return (
    <FadeIn visible duration={200} fromY={8} fill={false}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Consulta${item.patientName ? ` de ${item.patientName}` : ''}`}
      >
        <View style={styles.cardRow}>
          {/* Video icon container */}
          <View style={styles.iconContainer}>
            <Ionicons name="videocam" size={20} color="#8B5CF6" />
          </View>

          {/* Content */}
          <View style={styles.cardContent}>
            <View style={styles.topRow}>
              <Text style={styles.patientName} numberOfLines={1} ellipsizeMode="tail">
                {item.patientName ?? 'Paciente'}
              </Text>
              <StatusBadge status={item.status} size="sm" />
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>{dateStr}</Text>
              <Ionicons name="time-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>{timeStr}</Text>
            </View>

            {item.symptoms ? (
              <Text style={styles.symptomsText} numberOfLines={1} ellipsizeMode="tail">
                {item.symptoms.length > 60 ? item.symptoms.slice(0, 60) + '...' : item.symptoms}
              </Text>
            ) : null}
          </View>

          {/* Chevron or Join button */}
          {joinable ? (
            <Pressable
              style={styles.joinButton}
              onPress={onPress}
              accessibilityLabel="Entrar na consulta"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="videocam" size={14} color="#FFFFFF" />
              <Text style={styles.joinButtonText}>Entrar</Text>
            </Pressable>
          ) : (
            <View style={styles.chevronWrap}>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          )}
        </View>
      </Pressable>
    </FadeIn>
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.item.status === next.item.status &&
  prev.item.updatedAt === next.item.updatedAt
);

// ── Main Screen ─────────────────────────────────────────────────
export default function DoctorConsultations() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { colors, shadows } = useAppTheme({ role: 'doctor' });
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

  const handleTabChange = useCallback((key: string) => {
    haptics.selection();
    setTab(key as TabValue);
  }, []);

  const segmentedItems = useMemo(
    () => TAB_ITEMS.map((t) => ({
      key: t.key,
      label: t.label,
      count: t.key === 'active' ? active.length : history.length,
    })),
    [active.length, history.length]
  );

  const renderItem = useCallback(
    ({ item }: { item: RequestResponseDto }) => (
      <ConsultationCardInner
        item={item}
        onPress={() => handleItemPress(item)}
        colors={colors}
        shadows={shadows}
      />
    ),
    [handleItemPress, colors, shadows]
  );

  const keyExtractor = useCallback((item: RequestResponseDto) => item.id, []);
  const empty = !isLoading && sortedList.length === 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Consultas</Text>
          {active.length > 0 && (
            <View style={styles.countBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.countText}>
                {active.length} {active.length === 1 ? 'ativa' : 'ativas'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── SEGMENTED TABS ── */}
      <AppSegmentedControl
        items={segmentedItems}
        value={tab}
        onValueChange={handleTabChange}
        disabled={isLoading}
        role="doctor"
      />

      {/* ── LIST ── */}
      {isLoading && consultations.length === 0 ? (
        <View style={styles.loadingWrap}>
          <SkeletonList count={6} />
        </View>
      ) : isError && consultations.length === 0 ? (
        <AppEmptyState
          icon="alert-circle-outline"
          title="Erro ao carregar"
          subtitle="Verifique sua conexão e tente novamente."
          actionLabel="Tentar novamente"
          onAction={() => refetch()}
        />
      ) : (
        <FadeIn visible={!isLoading} {...motionTokens.fade.listDoctor} delay={30}>
          <FlatList
            data={sortedList}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: listPadding },
              empty && styles.listContentEmpty,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            windowSize={7}
            maxToRenderPerBatch={10}
            initialNumToRender={8}
            removeClippedSubviews={Platform.OS !== 'web'}
            ListEmptyComponent={
              <AppEmptyState
                icon="videocam-outline"
                title={tab === 'active' ? 'Nenhuma consulta ativa' : 'Nenhuma consulta no histórico'}
                subtitle={tab === 'active'
                  ? 'Consultas agendadas aparecerão aqui.'
                  : 'Consultas finalizadas aparecerão aqui.'}
              />
            }
          />
        </FadeIn>
      )}
    </View>
  );
}

// ── Screen Styles ───────────────────────────────────────────────
function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F8FAFC',
    },
    header: {
      backgroundColor: colors.surface,
      paddingHorizontal: pad,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 0,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    countBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.successLight,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      gap: 6,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    countText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.success,
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
    listContentEmpty: {
      flexGrow: 1,
    },
  });
}

// ── Card Styles ─────────────────────────────────────────────────
function makeCardStyles(colors: DesignColors, shadows: DesignTokens['shadows']) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#F1F5F9',
      marginBottom: 10,
      padding: 14,
      ...shadows.card,
    },
    cardPressed: {
      transform: [{ scale: 0.985 }],
      opacity: 0.92,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#EDE9FE',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      flexShrink: 0,
    },
    cardContent: {
      flex: 1,
      minWidth: 0,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
      gap: 8,
    },
    patientName: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
      minWidth: 0,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 2,
    },
    metaText: {
      fontSize: 12,
      fontWeight: '400',
      color: colors.textMuted,
      marginRight: 6,
    },
    symptomsText: {
      fontSize: 12,
      fontWeight: '400',
      color: colors.textMuted,
      marginTop: 2,
    },
    joinButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#16A34A',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      gap: 4,
      marginLeft: 8,
      flexShrink: 0,
    },
    joinButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    chevronWrap: {
      marginLeft: 8,
      flexShrink: 0,
      justifyContent: 'center',
    },
  });
}
