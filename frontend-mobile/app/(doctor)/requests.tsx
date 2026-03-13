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
import { useRequestsEvents } from '../../contexts/RequestsEventsContext';
import { useDoctorRequestsQuery, useInvalidateDoctorRequests } from '../../lib/hooks/useDoctorRequestsQuery';
import RequestCard from '../../components/RequestCard';
import { AppSegmentedControl, AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { showToast } from '../../components/ui/Toast';
import { haptics } from '../../lib/haptics';
import { motionTokens } from '../../lib/ui/motion';
import { useEffect } from 'react';

const pad = doctorDS.screenPaddingHorizontal;

const TYPE_FILTER_ITEMS = [
  { key: 'all', label: 'Todos' },
  { key: 'prescription', label: 'Receitas', type: 'prescription' },
  { key: 'exam', label: 'Exames', type: 'exam' },
  { key: 'consultation', label: 'Consultas', type: 'consultation' },
];

export default function DoctorQueue() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const { colors } = useAppTheme({ role: 'doctor' });
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
    return subscribe(() => invalidateDoctorRequests());
  }, [subscribe, invalidateDoctorRequests]);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

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

  const error = isError ? ((queryError as Error)?.message ?? 'Erro ao carregar') : null;
  const empty = !loading && !error && filteredRequests.length === 0;
  const isQueueEmpty = empty && requests.length === 0;
  const isFilteredEmpty = empty && requests.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* ── HEADER COMPACTO ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Pedidos</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{filteredRequests.length}</Text>
          </View>
        </View>

        {/* Busca inline no header */}
        <View
          style={[
            styles.searchWrap,
            { borderColor: searchFocused ? colors.primary : colors.borderLight },
          ]}
        >
          <Ionicons name="search" size={16} color={searchFocused ? colors.primary : colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar paciente…"
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); haptics.light(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── FILTROS ── */}
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
          onAction={() => refetch()}
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
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />
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
      marginBottom: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    countBadge: {
      minWidth: 32,
      height: 28,
      borderRadius: 14,
      backgroundColor: (colors as { primaryGhost?: string; infoLight: string }).primaryGhost ?? (colors as { infoLight: string }).infoLight,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    countText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontWeight: '400',
      paddingVertical: 10,
      color: colors.text,
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
    listContentEmpty: { flexGrow: 1 },
  });
}
