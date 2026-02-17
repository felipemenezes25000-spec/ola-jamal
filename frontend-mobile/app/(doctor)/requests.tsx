import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import { getRequests } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import RequestCard from '../../components/RequestCard';

const FILTER_LABELS: Record<string, { title: string; subtitle: string }> = {
  submitted: { title: 'Fila', subtitle: 'Solicitações aguardando sua análise' },
  in_review: { title: 'Em Análise', subtitle: 'Solicitações em revisão' },
  signed_delivered: { title: 'Assinados', subtitle: 'Documentos assinados e entregues' },
  consultation: { title: 'Consultas', subtitle: 'Solicitações de consulta' },
};

export default function DoctorQueue() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string; type?: string; filter?: string }>();
  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const status = params.status;
  const type = params.type;
  const filter = params.filter;

  const label = filter
    ? FILTER_LABELS[filter]
    : status
      ? FILTER_LABELS[status]
      : type
        ? FILTER_LABELS[type]
        : { title: 'Fila de Solicitações', subtitle: 'Solicitações aguardando revisão' };

  const loadData = useCallback(async () => {
    try {
      if (filter === 'signed_delivered') {
        const [signed, delivered] = await Promise.all([
          getRequests({ page: 1, pageSize: 100, status: 'signed' }),
          getRequests({ page: 1, pageSize: 100, status: 'delivered' }),
        ]);
        const all = [...(signed?.items ?? []), ...(delivered?.items ?? [])];
        all.sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
        setRequests(all);
      } else {
        const data = await getRequests({
          page: 1,
          pageSize: 100,
          ...(status && { status }),
          ...(type && { type }),
        });
        setRequests(data?.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, type, filter]);

  useEffect(() => { loadData(); }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      const interval = setInterval(loadData, 25000);
      return () => clearInterval(interval);
    }, [loadData])
  );

  const onRefresh = () => { setRefreshing(true); loadData(); };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{label.title}</Text>
        <Text style={styles.subtitle}>{label.subtitle}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.secondary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              onPress={() => router.push(`/doctor-request/${item.id}`)}
              showPatientName
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.secondary]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle" size={48} color={colors.border} />
              <Text style={styles.emptyText}>Nenhuma solicitação na fila</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 60, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  listContent: { paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.sm },
  emptyText: { fontSize: 15, color: colors.textMuted },
});
