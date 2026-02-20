import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, gradients, doctorDS } from '../../lib/themeDoctor';
import { getRequests, sortRequestsByNewestFirst } from '../../lib/api';
import { RequestResponseDto, RequestType } from '../../types/database';
import RequestCard from '../../components/RequestCard';
import { EmptyState } from '../../components/EmptyState';
import { RequestTypeFilter } from '../../components/RequestTypeFilter';

const LOG_QUEUE = __DEV__ && false;

const FILTER_ITEMS: { key: string; label: string; type?: RequestType }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'prescription', label: 'Receitas', type: 'prescription' },
  { key: 'exam', label: 'Exames', type: 'exam' },
  { key: 'consultation', label: 'Consultas', type: 'consultation' },
];

export default function PatientRequests() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const filterConfig = useMemo(() => FILTER_ITEMS.find((f) => f.key === activeFilter), [activeFilter]);

  const loadData = useCallback(async (isRefresh = false) => {
    const rid = ++requestIdRef.current;
    const abort = new AbortController();
    abortRef.current = abort;

    if (!isRefresh) setLoading(true);
    setError(null);
    const start = Date.now();
    if (LOG_QUEUE) console.info('[QUEUE_FETCH] PatientRequests start', { rid });

    try {
      const response = await getRequests({ page: 1, pageSize: 100 }, { signal: abort.signal });
      if (rid !== requestIdRef.current) return;
      const items = response.items ?? [];
      setRequests(sortRequestsByNewestFirst(items));
      if (LOG_QUEUE) console.info('[QUEUE_FETCH] PatientRequests success', { rid, ms: Date.now() - start });
    } catch (e: unknown) {
      if (rid !== requestIdRef.current) return;
      if ((e as { name?: string })?.name === 'AbortError') return;
      const msg = (e as Error)?.message ?? String(e);
      setError(msg);
      setRequests([]);
      if (LOG_QUEUE) console.info('[QUEUE_FETCH] PatientRequests error', { rid, msg });
    } finally {
      if (rid === requestIdRef.current) {
        setLoading(false);
        setIsRefreshing(false);
        abortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    loadData();
    return () => { abortRef.current?.abort(); };
  }, [loadData]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    let result = requests;
    if (filterConfig?.type) {
      result = result.filter((r) => r.requestType === filterConfig.type);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.doctorName?.toLowerCase().includes(q) ||
          r.medications?.some((m) => String(m).toLowerCase().includes(q)) ||
          r.exams?.some((m) => String(m).toLowerCase().includes(q)) ||
          r.requestType.toLowerCase().includes(q)
      );
    }
    setFilteredRequests(sortRequestsByNewestFirst(result));
  }, [requests, filterConfig?.type, search]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData(true);
  }, [loadData]);

  const handleRetry = useCallback(() => {
    setError(null);
    loadData();
  }, [loadData]);

  const headerPaddingTop = insets.top + 12;
  const empty = !loading && !error && filteredRequests.length === 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...gradients.doctorHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, styles.headerGradient, { paddingTop: headerPaddingTop }]}
      >
        <Text style={styles.title}>Meus Pedidos</Text>
      </LinearGradient>

      <Text style={styles.headerHint}>Toque em um pedido para ver detalhes e acompanhar o status. Use os filtros para encontrar o que precisa.</Text>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por medicamento, médico..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          editable={!loading}
        />
      </View>

      <RequestTypeFilter
        items={FILTER_ITEMS.map(({ key, label }) => ({ key, label }))}
        value={activeFilter}
        onValueChange={setActiveFilter}
        disabled={loading}
        variant="patient"
      />

      {loading && requests.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando pedidos...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorTitle}>Não foi possível carregar</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestCard request={item} onPress={() => router.push(`/request-detail/${item.id}`)} />
          )}
          contentContainerStyle={[styles.listContent, empty && styles.listContentEmpty]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            empty ? (
              <EmptyState
                icon="document-text-outline"
                title="Nenhum pedido encontrado"
                subtitle="Tente ajustar os filtros ou a busca"
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerGradient: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 6,
    marginBottom: 4,
    lineHeight: 18,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  loadingText: { fontSize: 14, color: colors.textMuted },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  errorTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  errorMsg: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: borderRadius.md },
  retryText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  listContent: { paddingTop: doctorDS.sectionGap, paddingHorizontal: spacing.lg, paddingBottom: 100 },
  listContentEmpty: { flexGrow: 1 },
  separator: { height: spacing.sm },
});
