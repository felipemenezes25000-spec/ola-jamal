import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, gradients, borderRadius } from '../../lib/themeDoctor';
import { getRequests, sortRequestsByNewestFirst } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import RequestCard from '../../components/RequestCard';
import { EmptyState } from '../../components/EmptyState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SkeletonList } from '../../components/ui/SkeletonLoader';

const LOG_QUEUE = __DEV__ && false;

const TYPE_FILTER_ITEMS: { key: string; label: string; type?: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'prescription', label: 'Receitas', type: 'prescription' },
  { key: 'exam', label: 'Exames', type: 'exam' },
  { key: 'consultation', label: 'Consulta', type: 'consultation' },
];

function getHeaderLabel(activeKey: string): { title: string; subtitle: string } {
  const item = TYPE_FILTER_ITEMS.find((c) => c.key === activeKey);
  if (item?.key === 'all') return { title: 'Fila de Pedidos', subtitle: 'Todos os pedidos' };
  if (item?.type === 'prescription') return { title: 'Receitas', subtitle: 'Pedidos de receita' };
  if (item?.type === 'exam') return { title: 'Exames', subtitle: 'Pedidos de exame' };
  if (item?.type === 'consultation') return { title: 'Consultas', subtitle: 'Solicitações de consulta' };
  return { title: 'Fila de Pedidos', subtitle: 'Todos os pedidos' };
}

export default function DoctorQueue() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const typeParam = useMemo(() => TYPE_FILTER_ITEMS.find((c) => c.key === activeFilter)?.type, [activeFilter]);
  const label = useMemo(() => getHeaderLabel(activeFilter), [activeFilter]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      const rid = ++requestIdRef.current;
      const abort = new AbortController();
      abortRef.current = abort;

      if (!isRefresh) setLoading(true);
      setError(null);
      const start = Date.now();
      if (LOG_QUEUE) console.info('[QUEUE_FETCH] DoctorQueue start', { rid, type: typeParam });

      try {
        const data = await getRequests(
          { page: 1, pageSize: 100, ...(typeParam && { type: typeParam }) },
          { signal: abort.signal }
        );
        if (rid !== requestIdRef.current) return;
        const items = data?.items ?? [];
        setRequests(sortRequestsByNewestFirst(items));
        if (LOG_QUEUE) console.info('[QUEUE_FETCH] DoctorQueue success', { rid, ms: Date.now() - start });
      } catch (e: unknown) {
        if (rid !== requestIdRef.current) return;
        if ((e as { name?: string })?.name === 'AbortError') return;
        if ((e as { status?: number })?.status === 401) return;
        const msg = (e as Error)?.message ?? String(e);
        setError(msg);
        setRequests([]);
        if (LOG_QUEUE) console.info('[QUEUE_FETCH] DoctorQueue error', { rid, msg });
      } finally {
        if (rid === requestIdRef.current) {
          setLoading(false);
          setIsRefreshing(false);
          abortRef.current = null;
        }
      }
    },
    [typeParam]
  );

  useEffect(() => {
    loadData();
    return () => { abortRef.current?.abort(); };
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      const interval = setInterval(() => loadData(true), 25000);
      return () => clearInterval(interval);
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData(true);
  }, [loadData]);

  const handleRetry = useCallback(() => {
    setError(null);
    loadData();
  }, [loadData]);

  const handleFilterChange = useCallback((key: string) => setActiveFilter(key), []);

  const headerPaddingTop = insets.top + 12;
  const empty = !loading && !error && requests.length === 0;

  return (
    <View style={styles.container}>
      {/* Ocean Blue gradient header */}
      <LinearGradient
        colors={gradients.doctorHeader as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: headerPaddingTop }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{label.title}</Text>
            <Text style={styles.subtitle}>{label.subtitle}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{requests.length}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Segmented control */}
      <SegmentedControl
        items={TYPE_FILTER_ITEMS.map((c) => ({ key: c.key, label: c.label }))}
        value={activeFilter}
        onValueChange={handleFilterChange}
        disabled={loading}
      />

      {/* Content */}
      {loading && requests.length === 0 ? (
        <View style={styles.loadingWrap}>
          <SkeletonList count={5} />
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorTitle}>Não foi possível carregar</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              onPress={() => router.push(`/doctor-request/${item.id}`)}
              showPatientName
            />
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
                icon="checkmark-done-circle"
                emoji="📭"
                title="Nenhum pedido aqui"
                subtitle="Ajuste os filtros ou volte ao painel para ver todos os pedidos"
                actionLabel="Voltar ao painel"
                onAction={() => router.push('/(doctor)/dashboard')}
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 22,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  countText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: '#fff',
  },
  loadingWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: '600',
    color: colors.text,
  },
  errorMsg: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 26,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  retryText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: '600',
    color: '#fff',
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
  listContentEmpty: { flexGrow: 1 },
  separator: { height: spacing.xs },
});
