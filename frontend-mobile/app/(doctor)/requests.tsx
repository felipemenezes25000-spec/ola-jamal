import React, { useCallback, useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, doctorDS } from '../../lib/themeDoctor';
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

const TYPE_FILTER_ITEMS: { key: string; label: string; type?: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'prescription', label: 'Receitas', type: 'prescription' },
  { key: 'exam', label: 'Exames', type: 'exam' },
  { key: 'consultation', label: 'Consultas', type: 'consultation' },
];

function getHeaderLabel(activeKey: string): { title: string; subtitle: string } {
  const item = TYPE_FILTER_ITEMS.find((c) => c.key === activeKey);
  if (item?.key === 'all') return { title: 'Painel', subtitle: 'Atendimentos e pedidos' };
  if (item?.type === 'prescription') return { title: 'Receitas', subtitle: 'Pedidos de receita' };
  if (item?.type === 'exam') return { title: 'Exames', subtitle: 'Pedidos de exame' };
  if (item?.type === 'consultation') return { title: 'Consultas', subtitle: 'Solicitações de consulta' };
  return { title: 'Painel', subtitle: 'Atendimentos e pedidos' };
}

export default function DoctorQueue() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { colors, gradients } = useAppTheme();
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

  // SignalR: quando chega evento, invalida cache → React Query refetcha automaticamente
  useEffect(() => {
    return subscribe(() => {
      invalidateDoctorRequests();
    });
  }, [subscribe, invalidateDoctorRequests]);

  // Refetch silencioso ao voltar para a tela
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
      showToast({ message: 'Não foi possível atualizar a fila', type: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleFilterChange = useCallback((key: string) => {
    haptics.selection();
    setActiveFilter(key);
  }, []);

  const typeParam = useMemo(
    () => TYPE_FILTER_ITEMS.find((c) => c.key === activeFilter)?.type,
    [activeFilter]
  );
  const label = useMemo(() => getHeaderLabel(activeFilter), [activeFilter]);

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
            <Text style={styles.countText}>{filteredRequests.length}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.contentSection}>
        <View style={styles.periodRow}>
          {periodSummary.map(({ label: periodLabel, count }) => (
            <View key={periodLabel} style={styles.periodChip}>
              <Text style={styles.periodChipLabel} numberOfLines={1}>{periodLabel}</Text>
              <Text style={styles.periodChipCount}>{count}</Text>
            </View>
          ))}
        </View>

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

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome do paciente"
          placeholderTextColor={colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Buscar paciente"
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchText('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Limpar busca"
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading && requests.length === 0 ? (
        <View style={styles.loadingWrap}>
          <SkeletonList count={5} />
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
                  subtitle="Quando pacientes enviarem solicitações, elas aparecerão aqui para revisão."
                />
              ) : isFilteredEmpty ? (
                <AppEmptyState
                  icon="search-outline"
                  title="Nenhum resultado"
                  subtitle={
                    searchText.trim()
                      ? `Nenhum paciente encontrado para "${searchText.trim()}"`
                      : 'Tente ajustar o filtro ou limpar a busca.'
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
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
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
    color: colors.white,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.full,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.white,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginHorizontal: pad,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    paddingVertical: 12,
  },
  contentSection: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: pad,
    marginBottom: spacing.sm,
  },
  periodChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  periodChipCount: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  loadingWrap: {
    flex: 1,
    paddingHorizontal: pad,
    paddingTop: spacing.lg,
  },
  listContent: {
    paddingTop: spacing.md,
    paddingHorizontal: pad,
  },
  listContentEmpty: { flexGrow: 1 },
  });
}
