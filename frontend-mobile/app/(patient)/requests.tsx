import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, AppState, AppStateStatus } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/EmptyState';
import { usePushNotification } from '../../contexts/PushNotificationContext';
import { fetchRequests } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'prescription', label: 'Receitas' },
  { key: 'exam', label: 'Exames' },
  { key: 'consultation', label: 'Consultas' },
];

export default function PatientRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { lastNotificationAt } = usePushNotification();

  useEffect(() => { loadRequests(true); }, [activeFilter]);
  useEffect(() => { if (lastNotificationAt > 0) loadRequests(true); }, [lastNotificationAt]);

  // Auto-refresh ao voltar para a tela, ao retornar o app ao primeiro plano e a cada 5s (polling)
  useFocusEffect(useCallback(() => {
    loadRequests(true);
    const interval = setInterval(() => loadRequests(true), 5000);
    return () => clearInterval(interval);
  }, [activeFilter]));
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        loadRequests(true);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [activeFilter]);

  const loadRequests = async (reset = false) => {
    const currentPage = reset ? 1 : page;
    try {
      const response = await fetchRequests({
        type: activeFilter === 'all' ? undefined : activeFilter,
        page: currentPage,
        pageSize: 20,
      });
      const newItems = response.items.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i);
      if (reset) {
        setRequests(newItems);
        setPage(2);
      } else {
        setRequests(prev => {
          const seen = new Set(prev.map(r => r.id));
          const toAdd = newItems.filter(r => !seen.has(r.id));
          return [...prev, ...toAdd];
        });
        setPage(currentPage + 1);
      }
      setHasMore(response.items.length === 20 && currentPage * 20 < response.totalCount);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests(true);
  };

  const getIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'prescription': return 'medical';
      case 'exam': return 'flask';
      case 'consultation': return 'videocam';
      default: return 'document';
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case 'prescription': return 'Receita';
      case 'exam': return 'Exame';
      case 'consultation': return 'Consulta';
      default: return type;
    }
  };

  const renderItem = ({ item }: { item: RequestResponseDto }) => (
    <TouchableOpacity onPress={() => router.push(`/request-detail/${item.id}`)}>
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.iconBg}>
            <Ionicons name={getIcon(item.requestType)} size={22} color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{getLabel(item.requestType)}</Text>
            <Text style={styles.cardDate}>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</Text>
            {item.prescriptionType && (
              <Text style={styles.cardSub}>Tipo: {item.prescriptionType}</Text>
            )}
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Minhas Solicitações</Text>
      </View>

      <View style={styles.filtersRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, activeFilter === f.key && styles.filterActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[styles.filterText, activeFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={requests}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onEndReached={() => hasMore && loadRequests()}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="document-text-outline"
              title="Nenhuma solicitação"
              description="Suas solicitações aparecerão aqui"
              actionLabel="Nova Solicitação"
              onAction={() => router.push('/new-request/prescription')}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { ...typography.h2, color: colors.primaryDarker },
  filtersRow: {
    flexDirection: 'row', paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md, gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: borderRadius.full, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.gray200,
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.caption, color: colors.gray600 },
  filterTextActive: { color: colors.white },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconBg: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryPaler, justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.md,
  },
  cardInfo: { flex: 1 },
  cardTitle: { ...typography.bodySmallMedium, color: colors.gray800 },
  cardDate: { ...typography.caption, color: colors.gray400, marginTop: 2 },
  cardSub: { ...typography.caption, color: colors.gray500, marginTop: 1 },
});
