import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  TextInput,
  Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doctorDS } from '../../lib/themeDoctor';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { RequestResponseDto } from '../../types/database';
import { cacheRequest } from '../doctor-request/[id]';
import { useRequestsEvents } from '../../contexts/RequestsEventsContext';
import { getHistoricalGroupedByPeriod } from '../../lib/domain/getRequestUiState';
import { useDoctorRequestsQuery, useInvalidateDoctorRequests } from '../../lib/hooks/useDoctorRequestsQuery';
import RequestCard from '../../components/RequestCard';
import { AppSegmentedControl, AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { showToast } from '../../components/ui/Toast';
import { haptics } from '../../lib/haptics';
import { motionTokens } from '../../lib/ui/motion';

const pad = doctorDS.screenPaddingHorizontal;

const ListSeparator = () => null;

const TYPE_FILTER_ITEMS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; type?: string }[] = [
  { key: 'all', label: 'Todos', icon: 'apps' },
  { key: 'prescription', label: 'Receitas', icon: 'document-text', type: 'prescription' },
  { key: 'exam', label: 'Exames', icon: 'flask', type: 'exam' },
  { key: 'consultation', label: 'Consultas', icon: 'videocam', type: 'consultation' },
];

function getHeaderMeta(activeKey: string): { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap } {
  switch (activeKey) {
    case 'prescription': return { title: 'Receitas', subtitle: 'Pedidos de receita', icon: 'document-text' };
    case 'exam': return { title: 'Exames', subtitle: 'Pedidos de exame', icon: 'flask' };
    case 'consultation': return { title: 'Consultas', subtitle: 'Solicitações de consulta', icon: 'videocam' };
    default: return { title: 'Pedidos', subtitle: 'Todos os atendimentos', icon: 'stats-chart' };
  }
}

// ── Period chip animado ────────────────────────────────────────
interface PeriodChipProps {
  label: string;
  count: number;
  colors: DesignColors;
  delay?: number;
}

function PeriodChip({ label, count, colors, delay = 0 }: PeriodChipProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, [opacity, translateY, delay]);

  return (
    <Animated.View
      style={[
        chipStyles.periodChip,
        { backgroundColor: colors.surface, borderColor: colors.borderLight, opacity, transform: [{ translateY }] },
      ]}
    >
      <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
      <Text style={[chipStyles.periodChipLabel, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
      <Text style={[chipStyles.periodChipCount, { color: colors.text }]}>{count}</Text>
    </Animated.View>
  );
}

const chipStyles = StyleSheet.create({
  periodChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    gap: 3,
  },
  periodChipLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  periodChipCount: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});

export default function DoctorQueue() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const { colors, gradients } = useAppTheme({ role: 'doctor' });
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { subscribe, isConnected } = useRequestsEvents();
  const invalidateDoctorRequests = useInvalidateDoctorRequests();

  const {
    data: requests = [],
    isLoading: loading,
    isError,
    error: queryError,
    refetch,
  } = useDoctorRequestsQuery(isConnected);

  useEffect(() => {
    return subscribe(() => {
      invalidateDoctorRequests();
    });
  }, [subscribe, invalidateDoctorRequests]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const onRefresh = useCallback(async () => {
    haptics.light();
    setIsRefreshing(true);
    try {
      await refetch();
      showToast({ message: 'Fila atualizada', type: 'success' });
    } catch {
      showToast({ message: 'Não foi possível atualizar', type: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleRetry = useCallback(() => { refetch(); }, [refetch]);

  const handleFilterChange = useCallback((key: string) => {
    haptics.selection();
    setActiveFilter(key);
  }, []);

  const typeParam = useMemo(
    () => TYPE_FILTER_ITEMS.find((c) => c.key === activeFilter)?.type,
    [activeFilter]
  );
  const headerMeta = useMemo(() => getHeaderMeta(activeFilter), [activeFilter]);

  const counts = useMemo(() => ({
    all: requests.length,
    prescription: requests.filter((r) => r.requestType === 'prescription').length,
    exam: requests.filter((r) => r.requestType === 'exam').length,
    consultation: requests.filter((r) => r.requestType === 'consultation').length,
  }), [requests]);

  const filteredRequests = useMemo(() => {
    let list = requests;
    if (typeParam) list = list.filter((r) => r.requestType === typeParam);
    const q = searchText.trim().toLowerCase();
    if (q) list = list.filter((r) => (r.patientName ?? '').toLowerCase().includes(q));
    return list;
  }, [requests, typeParam, searchText]);

  const periodSummary = useMemo(() => getHistoricalGroupedByPeriod(requests), [requests]);

  const keyExtractor = useCallback((item: RequestResponseDto) => item.id, []);
  const renderDoctorItem = useCallback(({ item }: { item: RequestResponseDto }) => (
    <RequestCard
      request={item}
      onPress={() => {
        haptics.selection();
        cacheRequest(item);
        router.push(`/doctor-request/${item.id}`);
      }}
      showPatientName
      showPrice={false}
      showRisk={false}
      suppressHorizontalMargin
    />
  ), [router]);

  const headerPaddingTop = insets.top + 16;
  const error = isError ? ((queryError as Error)?.message ?? 'Erro ao carregar') : null;
  const empty = !loading && !error && filteredRequests.length === 0;
  const isQueueEmpty = empty && requests.length === 0;
  const isFilteredEmpty = empty && requests.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* ── HEADER ── */}
      <LinearGradient
        colors={gradients.doctorHeader as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: headerPaddingTop }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerIconWrap}>
            <Ionicons name={headerMeta.icon} size={20} color={colors.headerOverlayText} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.headerOverlayText }]}>{headerMeta.title}</Text>
            <Text style={[styles.subtitle, { color: colors.headerOverlayTextMuted }]}>{headerMeta.subtitle}</Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: colors.headerOverlaySurface, borderColor: colors.headerOverlayBorder }]}>
            <Text style={[styles.countText, { color: colors.headerOverlayText }]}>{filteredRequests.length}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── PERIOD CHIPS ── */}
      {periodSummary.length > 0 && (
        <View style={styles.periodRow}>
          {periodSummary.map(({ label: periodLabel, count }, i) => (
            <PeriodChip
              key={periodLabel}
              label={periodLabel}
              count={count}
              colors={colors}
              delay={i * 60}
            />
          ))}
        </View>
      )}

      {/* ── FILTROS ── */}
      <View style={styles.filterSection}>
        <AppSegmentedControl
          items={TYPE_FILTER_ITEMS.map((c) => ({
            key: c.key,
            label: c.label,
            count: (counts as Record<string, number>)[c.key] ?? undefined,
          }))}
          value={activeFilter}
          onValueChange={handleFilterChange}
          disabled={loading}
          scrollable
        />
      </View>

      {/* ── BUSCA ── */}
      <View
        style={[
          styles.searchWrap,
          {
            backgroundColor: colors.surface,
            borderColor: searchFocused ? colors.primary : colors.border,
          },
        ]}
      >
        <Ionicons
          name="search"
          size={18}
          color={searchFocused ? colors.primary : colors.textMuted}
        />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Buscar por paciente…"
          placeholderTextColor={colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Buscar paciente"
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchText('');
              haptics.light();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Limpar busca"
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── LISTA ── */}
      {loading && requests.length === 0 ? (
        <View style={styles.loadingWrap}>
          <SkeletonList count={6} />
        </View>
      ) : error ? (
        <AppEmptyState
          icon="alert-circle-outline"
          title="Não foi possível carregar"
          subtitle={error}
          actionLabel="Tentar novamente"
          onAction={handleRetry}
        />
      ) : (
        <FadeIn visible={!loading} {...motionTokens.fade.listDoctor} delay={30}>
          <FlatList
            data={filteredRequests}
            keyExtractor={keyExtractor}
            renderItem={renderDoctorItem}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: listPadding },
              empty && styles.listContentEmpty,
            ]}
            ItemSeparatorComponent={ListSeparator}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={Platform.OS !== 'web'}
            maxToRenderPerBatch={10}
            windowSize={7}
            initialNumToRender={8}
            ListEmptyComponent={
              isQueueEmpty ? (
                <AppEmptyState
                  icon="checkmark-done-circle-outline"
                  title="Nenhum pedido por aqui"
                  subtitle="Quando pacientes enviarem solicitações, elas aparecerão aqui."
                />
              ) : isFilteredEmpty ? (
                <AppEmptyState
                  icon="search-outline"
                  title="Nenhum resultado"
                  subtitle={
                    searchText.trim()
                      ? `Nenhum paciente encontrado para "${searchText.trim()}"`
                      : 'Tente outro filtro ou limpe a busca.'
                  }
                />
              ) : null
            }
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
      paddingHorizontal: pad,
      paddingBottom: 24,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      flexShrink: 0,
    },
    headerText: { flex: 1, minWidth: 0 },
    title: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
    subtitle: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: 3,
    },
    countBadge: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginLeft: 12,
      flexShrink: 0,
    },
    countText: {
      fontSize: 16,
      fontWeight: '800',
    },

    // Period chips row
    periodRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: pad,
      paddingTop: 14,
    },

    // Filter section
    filterSection: {
      paddingTop: 10,
      paddingBottom: 4,
    },

    // Search
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      paddingHorizontal: 14,
      marginHorizontal: pad,
      marginTop: 8,
      marginBottom: 4,
      borderWidth: 1.5,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      fontWeight: '400',
      paddingVertical: 13,
    },

    loadingWrap: {
      flex: 1,
      paddingHorizontal: pad,
      paddingTop: 16,
    },
    listContent: {
      paddingTop: 12,
      paddingHorizontal: pad,
    },
    listContentEmpty: { flexGrow: 1 },
  });
}
