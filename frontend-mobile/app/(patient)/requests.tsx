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
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { uiTokens } from '../../lib/ui/tokens';
import { sortRequestsByNewestFirst } from '../../lib/api';
import { RequestResponseDto, RequestType } from '../../types/database';
import RequestCard from '../../components/RequestCard';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { AppHeader, AppSegmentedControl, AppEmptyState, TopSummaryStrip } from '../../components/ui';
import { useDebounce } from '../../hooks/useDebounce';
import { useTriageEval } from '../../hooks/useTriageEval';
import { haptics } from '../../lib/haptics';
import { showToast } from '../../components/ui/Toast';
import { motionTokens } from '../../lib/ui/motion';
import { useRequestsQuery, REQUESTS_QUERY_KEY } from '../../lib/hooks/useRequestsQuery';
import { useQueryClient } from '@tanstack/react-query';

const ListSeparator = () => null;

const FILTER_ITEMS: { key: string; label: string; type?: RequestType }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'prescription', label: 'Receitas', type: 'prescription' },
  { key: 'exam', label: 'Exames', type: 'exam' },
  { key: 'consultation', label: 'Consultas', type: 'consultation' },
];

// staleTime configurado em useRequestsQuery (30s) — refetch só se dado tiver mais tempo que isso
const REQUESTS_STALE_THRESHOLD_MS = 30_000;

export default function PatientRequests() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const queryClient = useQueryClient();

  const { colors, gradients } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

  // PERF: só refaz fetch ao focar se o dado tiver mais de 30s — respeita staleTime
  // em vez de disparar request desnecessária a cada troca de tab.
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

  const error = isError ? ((queryError as Error)?.message ?? 'Não foi possível carregar') : null;

  const keyExtractor = useCallback((item: RequestResponseDto) => item.id, []);
  const renderPatientItem = useCallback(({ item }: { item: RequestResponseDto }) => (
    <RequestCard
      request={item}
      onPress={() => {
        haptics.selection();
        router.push(`/request-detail/${item.id}`);
      }}
      suppressHorizontalMargin
    />
  ), [router]);

  const empty = !loading && !error && filteredRequests.length === 0;
  const isFirstTimeUser = empty && requests.length === 0;
  const isFilteredEmpty = empty && requests.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <View style={[styles.headerWrap, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerClip}>
          <AppHeader
            title="Meus pedidos"
            left={<View style={{ width: 44 }} />}
            gradient={gradients.patientHeader}
            skipSafeAreaTop
          />
        </View>
      </View>

      <TopSummaryStrip
        items={[
          { label: 'Total', value: counts.all },
          { label: 'No filtro', value: filteredRequests.length },
        ]}
      />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar pedidos"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          editable={!loading}
          accessibilityLabel="Buscar pedidos"
        />
      </View>

      <AppSegmentedControl
        items={FILTER_ITEMS.map(({ key, label }) => ({
          key,
          label,
          count: (counts as any)[key] ?? undefined,
        }))}
        value={activeFilter}
        onValueChange={(value) => {
          haptics.selection();
          setActiveFilter(value);
        }}
        disabled={loading}
        scrollable
      />

      {loading && requests.length === 0 ? (
        <View style={styles.loadingWrap}>
          <SkeletonList count={5} />
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorTitle}>Não foi possível carregar</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} accessibilityRole="button" accessibilityLabel="Tentar novamente">
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FadeIn visible={!loading} {...motionTokens.fade.listPatient} delay={30}>
          <FlatList
            data={filteredRequests}
            keyExtractor={keyExtractor}
            renderItem={renderPatientItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: listPadding }, empty && styles.listContentEmpty]}
            ItemSeparatorComponent={ListSeparator}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />
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
                  subtitle="Tente ajustar os filtros ou limpar a busca."
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
  headerWrap: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingBottom: 8,
  },
  headerClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: uiTokens.screenPaddingHorizontal,
    marginTop: 6,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  loadingWrap: { paddingHorizontal: 20, paddingTop: 20 },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  errorTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  errorMsg: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: borderRadius.md },
  retryText: { fontSize: 15, fontWeight: '600', color: colors.white },
  listContent: { paddingTop: 14, paddingHorizontal: uiTokens.screenPaddingHorizontal },
  listContentEmpty: { flexGrow: 1 },
  });
}
