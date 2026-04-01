import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { doctorDS } from '../../lib/themeDoctor';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { RequestResponseDto } from '../../types/database';
import { cacheRequest } from '../doctor-request/[id]';
import { useQueryClient } from '@tanstack/react-query';
import { useRequestsEvents } from '../../contexts/RequestsEventsContext';
import { useDoctorRequestsQuery, useInvalidateDoctorRequests } from '../../lib/hooks/useDoctorRequestsQuery';
import { QueueItem } from '../../components/doctor/QueueItem';
import { AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { showToast } from '../../components/ui/Toast';
import { haptics } from '../../lib/haptics';
// motionTokens removed — FadeIn cards use inline delay/duration
import { humanizeError } from '../../lib/errors/humanizeError';
import type { ApiError } from '../../lib/api-client';
import { useEffect } from 'react';

const pad = doctorDS.screenPaddingHorizontal;

const DOCTOR_REQUESTS_STALE_MS = 10_000;

const TYPE_FILTER_ITEMS = [
  { key: 'all', label: 'Todos', type: undefined },
  { key: 'prescription', label: 'Receitas', type: 'prescription' as const },
  { key: 'exam', label: 'Exames', type: 'exam' as const },
  { key: 'consultation', label: 'Consultas', type: 'consultation' as const },
];

export default function DoctorQueue() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { width: screenWidth } = useWindowDimensions();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const { colors } = useAppTheme({ role: 'doctor' });
  const styles = useMemo(() => makeStyles(colors, screenWidth), [colors, screenWidth]);

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
    return subscribe(() => invalidateDoctorRequests());
  }, [subscribe, invalidateDoctorRequests]);

  const queryClient = useQueryClient();
  useFocusEffect(useCallback(() => {
    const state = queryClient.getQueryState(['doctor-requests']);
    const age = Date.now() - (state?.dataUpdatedAt ?? 0);
    if (age > DOCTOR_REQUESTS_STALE_MS) refetch();
  }, [queryClient, refetch]));

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

  const handleFilterChange = useCallback((key: string) => {
    haptics.selection();
    setActiveFilter(key);
  }, []);

  const typeParam = useMemo(
    () => TYPE_FILTER_ITEMS.find((c) => c.key === activeFilter)?.type,
    [activeFilter]
  );

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

  const keyExtractor = useCallback((item: RequestResponseDto) => item.id, []);
  const renderDoctorItem = useCallback(({ item, index }: { item: RequestResponseDto; index: number }) => (
    <FadeIn visible delay={index * 40} duration={300} fromY={8} fill={false}>
      <QueueItem
        request={item}
        onPress={() => {
          haptics.selection();
          cacheRequest(item);
          router.push(`/doctor-request/${item.id}`);
        }}
        colors={colors}
      />
    </FadeIn>
  ), [router, colors]);

  const errorSubtitle = useMemo(() => {
    if (!isError || !queryError) return null;
    const err = queryError as ApiError;
    if (err?.status === 401) return 'Sessão expirada. Faça login novamente.';
    if (err?.status === 500) return 'Erro no servidor. Tente novamente em alguns instantes.';
    return humanizeError(queryError, 'request');
  }, [isError, queryError]);
  const error = isError ? (errorSubtitle ?? (queryError as Error)?.message ?? 'Erro ao carregar') : null;
  const empty = !loading && !error && filteredRequests.length === 0;
  const isQueueEmpty = empty && requests.length === 0;
  const isFilteredEmpty = empty && requests.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Pedidos</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{filteredRequests.length}</Text>
          </View>
        </View>

        {/* Search field */}
        <View
          style={[
            styles.searchWrap,
            searchFocused && styles.searchWrapFocused,
          ]}
        >
          <Ionicons
            name="search"
            size={16}
            color={searchFocused ? '#0EA5E9' : '#94A3B8'}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar paciente..."
            placeholderTextColor="#94A3B8"
            value={searchText}
            onChangeText={setSearchText}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar solicitações"
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchText(''); haptics.light(); }}
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
          {TYPE_FILTER_ITEMS.map((item) => {
            const isActive = activeFilter === item.key;
            const count = (counts as Record<string, number>)[item.key] ?? 0;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => handleFilterChange(item.key)}
                disabled={loading}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                ]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${item.label} ${count}`}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.filterChipCount,
                    isActive && styles.filterChipCountActive,
                  ]}
                >
                  ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── LIST ── */}
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
          onAction={() => refetch()}
        />
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={keyExtractor}
          renderItem={renderDoctorItem}
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
      )}
    </View>
  );
}

function makeStyles(colors: DesignColors, screenWidth: number) {
  // Responsive padding: narrower on small screens
  const horizontalPad = screenWidth <= 360 ? 12 : pad;

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
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: '#0F172A',
      letterSpacing: -0.3,
    },
    countBadge: {
      minWidth: 28,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#EFF6FF',
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
      gap: 4,
    },
    filterChipActive: {
      backgroundColor: '#0EA5E9',
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#64748B',
    },
    filterChipTextActive: {
      color: '#FFFFFF',
    },
    filterChipCount: {
      fontSize: 12,
      fontWeight: '600',
      color: '#94A3B8',
    },
    filterChipCountActive: {
      color: 'rgba(255,255,255,0.85)',
    },

    // ── List ──
    loadingWrap: {
      flex: 1,
      paddingHorizontal: horizontalPad,
      paddingTop: 16,
    },
    listContent: {
      paddingTop: 8,
      paddingHorizontal: horizontalPad,
    },
    listContentEmpty: { flexGrow: 1 },
  });
}
