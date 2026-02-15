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
  { key: 'pending', label: 'Pendentes' },
  { key: 'paid', label: 'Pagos' },
  { key: 'in_review', label: 'Em Análise' },
];

export default function DoctorRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const { lastNotificationAt } = usePushNotification();

  useEffect(() => { load(); }, [activeFilter]);
  useEffect(() => { if (lastNotificationAt > 0) load(); }, [lastNotificationAt]);

  // Auto-refresh ao voltar para a tela, ao retornar o app ao primeiro plano e a cada 5s (polling)
  useFocusEffect(useCallback(() => {
    load();
    const interval = setInterval(() => load(), 5000);
    return () => clearInterval(interval);
  }, [activeFilter]));
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        load();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [activeFilter]);

  const load = async () => {
    try {
      const status = activeFilter === 'all' ? undefined : activeFilter === 'pending' ? 'submitted' : activeFilter;
      const res = await fetchRequests({ status, page: 1, pageSize: 50 });
      const uniqueById = res.items.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i);
      setRequests(uniqueById);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const renderItem = ({ item }: { item: RequestResponseDto }) => (
    <TouchableOpacity onPress={() => router.push(`/doctor-request/${item.id}`)}>
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.typeRow}>
            <View style={styles.typeBg}>
              <Ionicons name={item.requestType === 'prescription' ? 'medical' : item.requestType === 'exam' ? 'flask' : 'videocam'} size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.patientName}>{item.patientName || 'Paciente'}</Text>
              <Text style={styles.typeText}>{item.requestType === 'prescription' ? 'Receita' : item.requestType === 'exam' ? 'Exame' : 'Consulta'}{item.prescriptionType ? ` (${item.prescriptionType})` : ''}</Text>
            </View>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>
        {item.aiSummaryForDoctor && <Text style={styles.aiSummary} numberOfLines={2}>{item.aiSummaryForDoctor}</Text>}
        <View style={styles.cardBottom}>
          <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</Text>
          {item.price != null && item.price > 0 && <Text style={styles.priceText}>R$ {item.price.toFixed(2)}</Text>}
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Fila de Solicitações</Text></View>
      <View style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.key} style={[styles.chip, activeFilter === f.key && styles.chipActive]} onPress={() => setActiveFilter(f.key)}>
            <Text style={[styles.chipText, activeFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={requests}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={!loading ? <EmptyState icon="list-outline" title="Nenhuma solicitação" description="Novas solicitações aparecerão aqui" /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { ...typography.h2, color: colors.primaryDarker },
  filters: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.gray600 },
  chipTextActive: { color: colors.white },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  typeRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  typeBg: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryPaler, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  patientName: { ...typography.bodySmallMedium, color: colors.gray800 },
  typeText: { ...typography.caption, color: colors.gray500 },
  aiSummary: { ...typography.caption, color: colors.gray600, backgroundColor: colors.primaryPaler, padding: spacing.sm, borderRadius: borderRadius.sm, marginTop: spacing.sm },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  dateText: { ...typography.caption, color: colors.gray400 },
  priceText: { ...typography.bodySmallMedium, color: colors.success },
});
