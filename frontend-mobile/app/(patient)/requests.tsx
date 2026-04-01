import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { sortRequestsByNewestFirst } from '../../lib/api';
import { RequestResponseDto, RequestType } from '../../types/database';
import { StatusBadge } from '../../components/StatusBadge';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { AppEmptyState } from '../../components/ui';
import { useDebounce } from '../../hooks/useDebounce';
import { useTriageEval } from '../../hooks/useTriageEval';
import { haptics } from '../../lib/haptics';
import { showToast } from '../../components/ui/Toast';
import { useRequestsQuery, REQUESTS_QUERY_KEY } from '../../lib/hooks/useRequestsQuery';
import { useQueryClient } from '@tanstack/react-query';
import { formatDateBR } from '../../lib/utils/format';

// ─── Constants ──────────────────────────────────────────────────

const FILTER_ITEMS: { key: string; label: string; type?: RequestType }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'prescription', label: 'Receitas', type: 'prescription' },
  { key: 'exam', label: 'Exames', type: 'exam' },
  { key: 'consultation', label: 'Consultas', type: 'consultation' },
];

const REQUESTS_STALE_THRESHOLD_MS = 30_000;

// ─── Type config for card icons ─────────────────────────────────

const TYPE_CONFIG: Record<string, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  label: string;
}> = {
  prescription: { icon: 'clipboard-outline', color: '#0EA5E9', bg: '#F0F9FF', label: 'Receita' },
  exam:         { icon: 'flask-outline',     color: '#22C55E', bg: '#F0FDF4', label: 'Exame' },
  consultation: { icon: 'videocam-outline',  color: '#8B5CF6', bg: '#F5F3FF', label: 'Consulta' },
};

const FALLBACK_TYPE = { icon: 'document-outline' as keyof typeof Ionicons.glyphMap, color: '#0EA5E9', bg: '#F0F9FF', label: 'Solicitação' };

// ─── Patient-friendly status labels ─────────────────────────────

const PATIENT_STATUS_LABELS: Record<string, string> = {
  submitted: 'Aguardando',
  in_review: 'Em análise',
  approved: 'Pronto',
  signed: 'Entregue',
  delivered: 'Entregue',
  searching_doctor: 'Aguardando',
  consultation_ready: 'Pronto',
  in_consultation: 'Em consulta',
  pending_post_consultation: 'Em análise',
  consultation_finished: 'Entregue',
  rejected: 'Cancelado',
  cancelled: 'Cancelado',
  pending: 'Aguardando',
  analyzing: 'Em análise',
  pending_payment: 'Aguardando',
  approved_pending_payment: 'Pronto',
  paid: 'Pronto',
  completed: 'Entregue',
};

// Active statuses that get a colored left border
const ACTIVE_STATUSES = new Set([
  'submitted', 'in_review', 'approved', 'searching_doctor',
  'consultation_ready', 'in_consultation', 'pending',
  'analyzing', 'pending_payment', 'approved_pending_payment', 'paid',
  'pending_post_consultation',
]);

// ─── Helpers ────────────────────────────────────────────────────

function getTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `há ${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'ontem';
  if (diffDay < 7) return `há ${diffDay} dias`;
  return formatDateBR(dateStr, { short: true });
}

function getDescriptionPreview(request: RequestResponseDto): string | null {
  if (request.requestType === 'prescription' && request.medications?.length) {
    const first = String(request.medications[0]);
    const more = request.medications.length > 1 ? ` +${request.medications.length - 1}` : '';
    return first + more;
  }
  if (request.requestType === 'exam' && request.exams?.length) {
    const first = String(request.exams[0]);
    const more = request.exams.length > 1 ? ` +${request.exams.length - 1}` : '';
    return first + more;
  }
  if (request.requestType === 'consultation' && request.symptoms) {
    return request.symptoms.length > 55 ? request.symptoms.slice(0, 55) + '...' : request.symptoms;
  }
  return null;
}

function getStatusBorderColor(status: string | null | undefined): string {
  if (!status) return 'transparent';
  if (['submitted', 'pending', 'searching_doctor', 'pending_payment'].includes(status)) return '#F59E0B';
  if (['in_review', 'analyzing', 'in_consultation', 'pending_post_consultation'].includes(status)) return '#0EA5E9';
  if (['approved', 'consultation_ready', 'approved_pending_payment', 'paid'].includes(status)) return '#22C55E';
  return 'transparent';
}

// ─── Request Card (inline, patient-specific design) ─────────────

interface PatientCardProps {
  request: RequestResponseDto;
  onPress: () => void;
  index: number;
}

const PatientRequestCard = React.memo(function PatientRequestCard({ request, onPress, index }: PatientCardProps) {
  const typeConf = TYPE_CONFIG[request.requestType] ?? FALLBACK_TYPE;
  const preview = getDescriptionPreview(request);
  const timeAgo = getTimeAgo(request.updatedAt || request.createdAt);
  const isActive = ACTIVE_STATUSES.has(request.status ?? '');
  const borderColor = isActive ? getStatusBorderColor(request.status) : 'transparent';
  const patientLabel = PATIENT_STATUS_LABELS[request.status ?? ''] ?? request.status ?? '';

  return (
    <FadeIn visible delay={index * 35} duration={280} fromY={8} fill={false}>
      <TouchableOpacity
        style={[
          cardStyles.container,
          isActive && { borderLeftWidth: 3, borderLeftColor: borderColor },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${typeConf.label}${request.doctorName ? ` com Dr(a). ${request.doctorName}` : ''}, ${patientLabel}`}
      >
        {/* Type icon */}
        <View style={[cardStyles.iconWrap, { backgroundColor: typeConf.bg }]}>
          <Ionicons name={typeConf.icon} size={20} color={typeConf.color} />
        </View>

        {/* Content */}
        <View style={cardStyles.content}>
          <View style={cardStyles.topRow}>
            <Text style={cardStyles.title} numberOfLines={1}>{typeConf.label}</Text>
            <StatusBadge status={request.status} size="sm" />
          </View>

          {request.doctorName ? (
            <Text style={cardStyles.subtitle} numberOfLines={1}>
              Dr(a). {request.doctorName}
            </Text>
          ) : null}

          {preview ? (
            <Text style={cardStyles.preview} numberOfLines={1}>{preview}</Text>
          ) : null}

          <Text style={cardStyles.timeAgo}>{timeAgo}</Text>
        </View>

        {/* Chevron */}
        <View style={cardStyles.chevronWrap}>
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </View>
      </TouchableOpacity>
    </FadeIn>
  );
}, (prev, next) =>
  prev.request.id === next.request.id &&
  prev.request.status === next.request.status &&
  prev.request.updatedAt === next.request.updatedAt &&
  prev.index === next.index
);

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
    marginBottom: 10,
    // Shadow
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.1,
    marginRight: 8,
    flex: 1,
    minWidth: 0,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#475569',
    marginBottom: 1,
  },
  preview: {
    fontSize: 12,
    fontWeight: '400',
    color: '#64748B',
    marginTop: 2,
  },
  timeAgo: {
    fontSize: 11,
    fontWeight: '400',
    color: '#94A3B8',
    marginTop: 4,
  },
  chevronWrap: {
    marginLeft: 8,
    flexShrink: 0,
    justifyContent: 'center',
  },
});

// ─── Main Screen ────────────────────────────────────────────────

export default function PatientRequests() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { width: screenWidth } = useWindowDimensions();
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();

  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, screenWidth), [colors, screenWidth]);

  const {
    data: requests = [],
    isLoading: loading,
    isError,
    error: queryError,
    refetch,
  } = useRequestsQuery();

  const filterConfig = useMemo(() => FILTER_ITEMS.find((f) => f.key === activeFilter), [activeFilter]);

  const counts = useMemo(() => ({
    all: requests.length,
    prescription: requests.filter((r) => r.requestType === 'prescription').length,
    exam: requests.filter((r) => r.requestType === 'exam').length,
    consultation: requests.filter((r) => r.requestType === 'consultation').length,
  }), [requests]);

  useFocusEffect(useCallback(() => {
    const state = queryClient.getQueryState(REQUESTS_QUERY_KEY);
    const age = Date.now() - (state?.dataUpdatedAt ?? 0);
    if (age > REQUESTS_STALE_THRESHOLD_MS) {
      refetch();
    }
  }, [queryClient, refetch]));

  useTriageEval({
    context: 'requests',
    step: 'entry',
    role: 'patient',
    totalRequests: requests.length,
  });

  const filteredRequests = useMemo(() => {
    let result = requests;
    if (filterConfig?.type) {
      result = result.filter((r) => r.requestType === filterConfig.type);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (r) =>
          r.doctorName?.toLowerCase().includes(q) ||
          r.medications?.some((m) => String(m).toLowerCase().includes(q)) ||
          r.exams?.some((m) => String(m).toLowerCase().includes(q)) ||
          (r.requestType ?? '').toLowerCase().includes(q)
      );
    }
    return sortRequestsByNewestFirst(result);
  }, [requests, filterConfig?.type, debouncedSearch]);

  const onRefresh = useCallback(async () => {
    haptics.light();
    setIsRefreshing(true);
    try {
      await refetch();
      showToast({ message: 'Pedidos atualizados', type: 'success' });
    } catch {
      showToast({ message: 'Não foi possível atualizar os pedidos', type: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleRetry = useCallback(() => { refetch(); }, [refetch]);

  const handleFilterChange = useCallback((key: string) => {
    haptics.selection();
    setActiveFilter(key);
  }, []);

  const error = isError ? ((queryError as Error)?.message ?? 'Não foi possível carregar') : null;

  const keyExtractor = useCallback((item: RequestResponseDto) => item.id, []);
  const renderItem = useCallback(({ item, index }: { item: RequestResponseDto; index: number }) => (
    <PatientRequestCard
      request={item}
      index={index}
      onPress={() => {
        haptics.selection();
        router.push(`/request-detail/${item.id}`);
      }}
    />
  ), [router]);

  const empty = !loading && !error && filteredRequests.length === 0;
  const isFirstTimeUser = empty && requests.length === 0;
  const isFilteredEmpty = empty && requests.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Meus Pedidos</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{requests.length}</Text>
          </View>
        </View>

        {/* Search field with clear button */}
        <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
          <Ionicons
            name="search"
            size={16}
            color={searchFocused ? '#0EA5E9' : '#94A3B8'}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar pedidos..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            editable={!loading}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar pedidos"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearch(''); haptics.light(); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Limpar busca"
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── HORIZONTAL FILTER CHIPS ── */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {FILTER_ITEMS.map((item) => {
            const isActive = activeFilter === item.key;
            const count = (counts as Record<string, number>)[item.key] ?? 0;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => handleFilterChange(item.key)}
                disabled={loading}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${item.label} ${count}`}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
                <View style={[styles.filterChipCountBadge, isActive && styles.filterChipCountBadgeActive]}>
                  <Text style={[styles.filterChipCount, isActive && styles.filterChipCountActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── SECTION LABEL ── */}
      {!loading && !error && filteredRequests.length > 0 && (
        <View style={styles.sectionLabelWrap}>
          <Text style={styles.sectionLabel}>
            {activeFilter === 'all' ? 'TODOS OS PEDIDOS' : FILTER_ITEMS.find(f => f.key === activeFilter)?.label?.toUpperCase() ?? 'PEDIDOS'}
          </Text>
          <Text style={styles.sectionCount}>{filteredRequests.length}</Text>
        </View>
      )}

      {/* ── LIST ── */}
      {loading && requests.length === 0 ? (
        <View style={styles.loadingWrap}>
          <SkeletonList count={5} />
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={40} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>Algo deu errado</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={handleRetry}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente"
          >
            <Ionicons name="refresh-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listPadding },
            empty && styles.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={['#0EA5E9']}
              tintColor="#0EA5E9"
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS !== 'web'}
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={8}
          ListEmptyComponent={
            isFirstTimeUser ? (
              <AppEmptyState
                icon="document-text-outline"
                title="Nenhum pedido ainda"
                subtitle="Crie sua primeira solicitação — receita, exame ou consulta — e acompanhe tudo aqui."
                actionLabel="Criar primeiro pedido"
                onAction={() => router.push('/new-request')}
              />
            ) : isFilteredEmpty ? (
              <AppEmptyState
                icon="search-outline"
                title="Nenhum resultado"
                subtitle={
                  search.trim()
                    ? `Nenhum resultado para "${search.trim()}". Tente outro termo.`
                    : 'Tente ajustar os filtros ou limpar a busca.'
                }
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

function makeStyles(colors: DesignColors, screenWidth: number) {
  const horizontalPad = screenWidth <= 360 ? 12 : 20;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F8FAFC',
    },

    // ── Header ──
    header: {
      backgroundColor: '#FFFFFF',
      paddingHorizontal: horizontalPad,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#F1F5F9',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 10,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: '#0F172A',
      letterSpacing: -0.3,
    },
    countBadge: {
      minWidth: 28,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#F0F9FF',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    countText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#0EA5E9',
    },

    // ── Search ──
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: '#F8FAFC',
      borderWidth: 1,
      borderColor: '#F1F5F9',
      gap: 8,
    },
    searchWrapFocused: {
      borderColor: '#0EA5E9',
      backgroundColor: '#FFFFFF',
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: '400',
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      color: '#0F172A',
    },

    // ── Filters ──
    filtersContainer: {
      backgroundColor: '#FFFFFF',
      paddingTop: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#F1F5F9',
    },
    filtersScroll: {
      paddingHorizontal: horizontalPad,
      gap: 8,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: '#F8FAFC',
      borderWidth: 1,
      borderColor: '#F1F5F9',
      gap: 6,
    },
    filterChipActive: {
      backgroundColor: '#0EA5E9',
      borderColor: '#0EA5E9',
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#64748B',
    },
    filterChipTextActive: {
      color: '#FFFFFF',
    },
    filterChipCountBadge: {
      minWidth: 20,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    filterChipCountBadgeActive: {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    filterChipCount: {
      fontSize: 11,
      fontWeight: '700',
      color: '#94A3B8',
    },
    filterChipCountActive: {
      color: '#FFFFFF',
    },

    // ── Section label ──
    sectionLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: horizontalPad,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 6,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: '#94A3B8',
      letterSpacing: 1.0,
    },
    sectionCount: {
      fontSize: 11,
      fontWeight: '700',
      color: '#CBD5E1',
    },

    // ── Loading ──
    loadingWrap: {
      flex: 1,
      paddingHorizontal: horizontalPad,
      paddingTop: 16,
    },

    // ── Error ──
    errorWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      gap: 8,
    },
    errorIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#FEF2F2',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#0F172A',
    },
    errorMsg: {
      fontSize: 14,
      fontWeight: '400',
      color: '#64748B',
      textAlign: 'center',
      lineHeight: 20,
    },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 20,
      backgroundColor: '#0EA5E9',
      borderRadius: 12,
    },
    retryText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // ── List ──
    listContent: {
      paddingTop: 4,
      paddingHorizontal: horizontalPad,
    },
    listContentEmpty: { flexGrow: 1 },
  });
}
