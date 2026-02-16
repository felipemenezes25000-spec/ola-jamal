import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import { getRequests } from '../../lib/api';
import { RequestResponseDto, UserDto } from '../../types/database';
import RequestCard from '../../components/RequestCard';
import { StatsCard } from '../../components/StatsCard';
import { ActionCard } from '../../components/ActionCard';

export default function PatientHome() {
  const router = useRouter();
  const [user, setUser] = useState<UserDto | null>(null);
  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem('@renoveja:user');
      if (userData) setUser(JSON.parse(userData));

      const response = await getRequests({ page: 1, pageSize: 50 });
      setRequests(response.items || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const stats = {
    total: requests.length,
    pending: requests.filter(r =>
      ['submitted', 'in_review', 'analyzing', 'searching_doctor'].includes(r.status)
    ).length,
    toPay: requests.filter(r =>
      ['approved_pending_payment', 'pending_payment', 'consultation_ready'].includes(r.status)
    ).length,
    ready: requests.filter(r =>
      ['signed', 'delivered', 'consultation_finished'].includes(r.status)
    ).length,
  };

  const recentRequests = requests.slice(0, 5);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      {/* Gradient Header */}
      <LinearGradient colors={['#0EA5E9', '#38BDF8', '#7DD3FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Olá, {user?.name?.split(' ')[0] || 'Paciente'}! 👋</Text>
            <Text style={styles.subtitle}>Gerencie suas solicitações médicas</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={colors.primary} />
          </View>
        </View>
      </LinearGradient>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatsCard icon="folder-open" iconColor="#3B82F6" label="Total" value={stats.total} />
        <StatsCard icon="time" iconColor="#F59E0B" label="Pendente" value={stats.pending} />
        <StatsCard icon="card" iconColor="#F97316" label="A Pagar" value={stats.toPay} />
        <StatsCard icon="checkmark-circle" iconColor="#10B981" label="Prontos" value={stats.ready} />
      </View>

      {/* New Request Actions */}
      <Text style={styles.sectionTitle}>Nova Solicitação</Text>
      <View style={styles.actionsRow}>
        <ActionCard
          icon="document-text"
          iconColor="#0EA5E9"
          label="Nova Receita"
          onPress={() => router.push('/new-request/prescription')}
        />
        <ActionCard
          icon="flask"
          iconColor="#8B5CF6"
          label="Novo Exame"
          onPress={() => router.push('/new-request/exam')}
        />
        <ActionCard
          icon="videocam"
          iconColor="#10B981"
          label="Consulta Online"
          onPress={() => router.push('/new-request/consultation')}
        />
      </View>

      {/* Recent Requests */}
      {recentRequests.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Solicitações Recentes</Text>
            <TouchableOpacity onPress={() => router.push('/(patient)/requests')}>
              <Text style={styles.seeAll}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          {recentRequests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              onPress={() => router.push(`/request-detail/${req.id}`)}
            />
          ))}
        </>
      )}

      {requests.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color={colors.border} />
          <Text style={styles.emptyTitle}>Nenhuma solicitação</Text>
          <Text style={styles.emptySubtitle}>Crie sua primeira solicitação acima</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginTop: -spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  seeAll: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
