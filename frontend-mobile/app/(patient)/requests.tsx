import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, gradients } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';
import { getRequests, sortRequestsByNewestFirst } from '../../lib/api';
import { RequestResponseDto, RequestType } from '../../types/database';
import RequestCard from '../../components/RequestCard';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { AppHeader, AppSegmentedControl, AppEmptyState } from '../../components/ui';
import { useDebounce } from '../../hooks/useDebounce';
import { useTriageEval } from '../../hooks/useTriageEval';
import { needsPayment } from '../../lib/domain/getRequestUiState';
import { haptics } from '../../lib/haptics';
import { showToast } from '../../components/ui/Toast';
import { motionTokens } from '../../lib/ui/motion';

const LOG_QUEUE = __DEV__ && false;
const ListSeparator = () => null;

const FILTER_ITEMS: { key: string; label: string; type?: RequestType }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'prescription', label: 'Receitas', type: 'prescription' },
  { key: 'exam', label: 'Exames', type: 'exam' },
  { key: 'consultation', label: 'Consultas', type: 'consultation' },
];

export default function PatientRequests() {
  const router = useRouter();
  const listPadding = useListBottomPadding();
  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const filterConfig = useMemo(() => FILTER_ITEMS.find((f) => f.key === activeFilter), [activeFilter]);

  const counts = useMemo(() => {
    const all = requests.length;
    const prescription = requests.filter((r) => r.requestType === 'prescription').length;
    const exam = requests.filter((r) => r.requestType === 'exam').length;
    const consultation = requests.filter((r) => r.requestType === 'consultation').length;
    return { all, prescription, exam, consultation };
  }, [requests]);

  const loadData = useCallback(async (isRefresh = false) => {
    const rid = ++requestIdRef.current;
    const abort = new AbortController();
    abortRef.current = abort;

    if (!isRefresh) setLoading(true);
    setError(null);
    const start = Date.now();
    if (LOG_QUEUE) console.info('[QUEUE_FETCH] PatientRequests start', { rid });

    try {
      const response = await getRequests({ page: 1, pageSize: 50 }, { signal: abort.signal });
      if (rid !== requestIdRef.current) return;
      const items = response.items ?? [];
      setRequests(sortRequestsByNewestFirst(items));
      if (isRefresh) {
        showToast({ message: 'Pedidos atualizados', type: 'success' });
      }
      if (LOG_QUEUE) console.info('[QUEUE_FETCH] PatientRequests success', { rid, ms: Date.now() - start });
    } catch (e: unknown) {
      if (rid !== requestIdRef.current) return;
      if ((e as { name?: string })?.name === 'AbortError') return;
      const msg = (e as Error)?.message ?? String(e);
      setError(msg);
      setRequests([]);
      if (isRefresh) {
        showToast({ message: 'Não foi possível atualizar os pedidos', type: 'error' });
      }
      if (LOG_QUEUE) console.info('[QUEUE_FETCH] PatientRequests error', { rid, msg });
    } finally {
      if (rid === requestIdRef.current) {
        setLoading(false);
        setIsRefreshing(false);
        abortRef.current = null;
      }
    }
  }, []);

  useEffect(() => () => { abortRef.current?.abort(); }, []);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const toPayCount = useMemo(() => requests.filter(r => needsPayment(r)).length, [requests]);
  useTriageEval({
    context: 'requests',
    step: 'entry',
    role: 'patient',
    totalRequests: requests.length,
    toPayCount,
  });

  useEffect(() => {
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
    setFilteredRequests(sortRequestsByNewestFirst(result));
  }, [requests, filterConfig?.type, debouncedSearch]);

  const onRefresh = useCallback(() => {
    haptics.light();
    setIsRefreshing(true);
    loadData(true);
  }, [loadData]);

  const handleRetry = useCallback(() => {
    setError(null);
    loadData();
  }, [loadData]);

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

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <View style={styles.headerClip}>
          <AppHeader
            title="Meus pedidos"
            left={<View style={{ width: 40 }} />}
            gradient={gradients.patientHeader}
          />
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por medicamento, médico..."
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
              empty ? (
                <AppEmptyState
                  icon="document-text-outline"
                  title="Nenhum pedido encontrado"
                  subtitle="Tente ajustar os filtros ou a busca"
                />
              ) : null
            }
          />
        </FadeIn>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerWrap: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerClip: {
    borderRadius: 22,
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
  retryText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  listContent: { paddingTop: 14, paddingHorizontal: uiTokens.screenPaddingHorizontal },
  listContentEmpty: { flexGrow: 1 },
});
