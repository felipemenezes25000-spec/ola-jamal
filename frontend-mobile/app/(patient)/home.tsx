import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import { getRequests } from '../../lib/api';
import { RequestResponseDto, UserDto } from '../../types/database';
import RequestCard from '../../components/RequestCard';
import { StatsCard } from '../../components/StatsCard';
import { ActionCard } from '../../components/ActionCard';

const MIN_TOUCH = 44;
const BP_SMALL = 376; // 2x2 em 320–375px, 4 cols acima

const HEADER_TOP_EXTRA = 12;
const HEADER_BOTTOM_BASE = 20;

export default function PatientHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [user, setUser] = useState<UserDto | null>(null);

  const isSmall = screenWidth < BP_SMALL;
  const statsGap = spacing.sm;
  const horizontalPad = Math.max(spacing.md, screenWidth * 0.04);
  const compact = screenWidth < 400;
  const headerPaddingTop = insets.top + HEADER_TOP_EXTRA;
  const headerPaddingBottom = compact ? HEADER_BOTTOM_BASE : spacing.lg;
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

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

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
      {/* Gradient Header - safe area + respiro no topo */}
      <LinearGradient colors={['#0EA5E9', '#38BDF8', '#7DD3FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingHorizontal: horizontalPad, paddingTop: headerPaddingTop, paddingBottom: headerPaddingBottom }]}>
        <View style={styles.headerContent}>
          <View style={[styles.headerText, { flex: 1, marginRight: spacing.md }]}>
            <Text style={[styles.greeting, { fontSize: Math.min(24, Math.max(18, screenWidth * 0.06)) }]}>
              Olá, {user?.name?.split(' ')[0] || 'Paciente'}! 👋
            </Text>
            <Text style={[styles.subtitle, { fontSize: Math.max(12, Math.min(14, screenWidth * 0.035)) }]}>
              Gerencie suas solicitações médicas
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.avatar,
              { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, width: Math.max(MIN_TOUCH, screenWidth * 0.12), height: Math.max(MIN_TOUCH, screenWidth * 0.12), borderRadius: Math.max(22, screenWidth * 0.06), opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => router.push('/(patient)/profile')}
            hitSlop={8}
          >
            <Ionicons name="person" size={isSmall ? 24 : 28} color={colors.primary} />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Stats Grid - 2x2 em 320–375px, 4 cols acima */}
      <View style={[styles.statsRow, { paddingHorizontal: horizontalPad, gap: statsGap, marginTop: compact ? -spacing.sm : -spacing.md, flexWrap: 'wrap', flexDirection: 'row' }]}>
        {[
          { icon: 'folder-open' as const, iconColor: '#3B82F6', label: 'Total', value: stats.total },
          { icon: 'time' as const, iconColor: '#F59E0B', label: 'Pendente', value: stats.pending },
          { icon: 'card' as const, iconColor: '#F97316', label: 'A Pagar', value: stats.toPay },
          { icon: 'checkmark-circle' as const, iconColor: '#10B981', label: 'Prontos', value: stats.ready },
        ].map((s) => (
          <View
            key={s.label}
            style={{
              flexBasis: isSmall ? '47%' : '23%',
              flexGrow: isSmall ? 0 : 1,
              flexShrink: 0,
              minWidth: 0,
            }}
          >
            <StatsCard icon={s.icon} iconColor={s.iconColor} label={s.label} value={s.value} />
          </View>
        ))}
      </View>

      {/* Nova Solicitação - above the fold */}
      <Text
        style={[
          styles.sectionTitle,
          {
            marginHorizontal: horizontalPad,
            marginTop: compact ? spacing.md : spacing.lg,
            marginBottom: compact ? spacing.sm : spacing.md,
            fontSize: Math.max(16, Math.min(18, screenWidth * 0.048)),
          },
        ]}
      >
        Nova Solicitação
      </Text>
      <View style={[styles.actionsRow, { paddingHorizontal: horizontalPad, flexDirection: 'row', gap: spacing.sm, flexWrap: 'nowrap' }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ActionCard
            compact
            icon="document-text"
            iconColor="#0EA5E9"
            label="Nova Receita"
            onPress={() => router.push('/new-request/prescription')}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ActionCard
            compact
            icon="flask"
            iconColor="#8B5CF6"
            label="Novo Exame"
            onPress={() => router.push('/new-request/exam')}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ActionCard
            compact
            icon="videocam"
            iconColor="#10B981"
            label="Consulta Online"
            onPress={() => router.push('/new-request/consultation')}
          />
        </View>
      </View>

      {/* Recent Requests */}
      {recentRequests.length > 0 && (
        <>
          <View style={[styles.sectionHeader, { marginHorizontal: horizontalPad, marginBottom: spacing.md }]}>
            <Text style={[styles.sectionTitle, { fontSize: Math.max(16, Math.min(18, screenWidth * 0.045)) }]}>
              Solicitações Recentes
            </Text>
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
        <View style={[styles.emptyState, { paddingHorizontal: horizontalPad }]}>
          <Ionicons name="document-text-outline" size={Math.min(64, Math.max(48, screenWidth * 0.15))} color={colors.border} />
          <Text style={[styles.emptyTitle, { fontSize: Math.max(16, Math.min(18, screenWidth * 0.045)) }]}>
            Nenhuma solicitação
          </Text>
          <Text style={[styles.emptySubtitle, { fontSize: Math.max(12, Math.min(14, screenWidth * 0.035)) }]}>
            Crie sua primeira solicitação acima
          </Text>
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
    borderRadius: 9999,
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
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: spacing.md,
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
