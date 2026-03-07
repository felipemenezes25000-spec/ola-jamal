import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { uiTokens } from '../../lib/ui/tokens';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../lib/api';
import { NotificationResponseDto } from '../../types/database';
import { useNotifications } from '../../contexts/NotificationContext';
import { AppHeader, AppSegmentedControl, AppEmptyState, TopSummaryStrip } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { showToast } from '../../components/ui/Toast';
import { haptics } from '../../lib/haptics';

function getDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return 'Esta semana';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

type NotificationFilterKey = 'all' | 'payment' | 'request' | 'other';

function getNotificationFilterType(item: NotificationResponseDto): Exclude<NotificationFilterKey, 'all'> {
  const t = (item.title || '').toLowerCase();
  const m = (item.message || '').toLowerCase();
  const hasPayment = item.data?.paymentId != null || t.includes('pagamento') || m.includes('pagamento') || t.includes('pago') || m.includes('pago');
  const hasRequest = t.includes('solicita') || m.includes('solicita') || t.includes('pedido') || m.includes('pedido') || t.includes('novo') || m.includes('novo');
  if (hasPayment) return 'payment';
  if (hasRequest) return 'request';
  return 'other';
}

const FILTER_ITEMS: { key: NotificationFilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'payment', label: 'Pagamentos' },
  { key: 'request', label: 'Solicitações' },
  { key: 'other', label: 'Outros' },
];

const ListSeparator = () => <View style={{ height: 10 }} />;
const SectionGap = () => <View style={{ height: 6 }} />;

export default function PatientNotifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshUnreadCount, markAllReadOptimistic, decrementUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<NotificationResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotificationFilterKey>('all');

  const { colors, gradients } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const loadData = useCallback(async (withFeedback = false) => {
    try {
      setError(false);
      const response = await getNotifications({ page: 1, pageSize: 50 });
      setNotifications(response.items || []);
      if (withFeedback) {
        showToast({ message: 'Notificações atualizadas', type: 'success' });
      }
    } catch (e) {
      console.error('Error loading notifications:', e);
      setError(true);
      if (withFeedback) {
        showToast({ message: 'Não foi possível atualizar as notificações', type: 'error' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      refreshUnreadCount();
    }, [loadData, refreshUnreadCount])
  );

  const onRefresh = () => {
    haptics.light();
    setRefreshing(true);
    loadData(true);
  };

  const handleMarkAllRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      await markAllReadOptimistic();
      haptics.success();
      showToast({ message: 'Todas as notificações foram marcadas como lidas', type: 'success' });
    } catch (error) {
      console.error('Error marking all as read:', error);
      haptics.error();
    }
  };

  const handleMarkRead = async (id: string, item?: NotificationResponseDto) => {
    decrementUnreadCount();
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await markNotificationAsRead(id);
      haptics.selection();
      const requestId = item?.data?.requestId;
      if (requestId) {
        router.push(`/request-detail/${requestId}`);
      }
    } catch (error) {
      console.error('Error marking as read:', error);
      refreshUnreadCount();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle' as const, color: colors.success };
      case 'warning': return { name: 'warning' as const, color: colors.warning };
      case 'error': return { name: 'alert-circle' as const, color: colors.error };
      default: return { name: 'information-circle' as const, color: colors.info };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Agora';
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Ontem';
    return `${days} dias atrás`;
  };

  const renderItem = ({ item }: { item: NotificationResponseDto }) => {
    const icon = getIcon(item.notificationType);
    const hours = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 3600000);
    const urgency = !item.read && hours <= 6 ? 'Urgente' : hours <= 24 ? 'Hoje' : 'Recente';

    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => handleMarkRead(item.id, item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Notificação: ${item.title}`}
      >
        <View style={[styles.iconContainer, { backgroundColor: icon.color + '15' }]}>
          <Ionicons name={icon.name} size={22} color={icon.color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]}>{item.title}</Text>
          <Text style={styles.cardMessage} numberOfLines={3}>{item.message}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
            <View style={[styles.urgencyBadge, urgency === 'Urgente' && styles.urgencyBadgeHigh]}>
              <Text style={[styles.urgencyText, urgency === 'Urgente' && styles.urgencyTextHigh]}>{urgency}</Text>
            </View>
          </View>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const counts = useMemo(() => {
    const all = notifications.length;
    const payment = notifications.filter((n) => getNotificationFilterType(n) === 'payment').length;
    const request = notifications.filter((n) => getNotificationFilterType(n) === 'request').length;
    const other = notifications.filter((n) => getNotificationFilterType(n) === 'other').length;
    return { all, payment, request, other };
  }, [notifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter((n) => getNotificationFilterType(n) === activeFilter);
  }, [activeFilter, notifications]);

  const sections = Object.entries(
    filteredNotifications.reduce<Record<string, NotificationResponseDto[]>>((acc, n) => {
      const g = getDateGroup(n.createdAt);
      if (!acc[g]) acc[g] = [];
      acc[g].push(n);
      return acc;
    }, {})
  ).map(([title, data]) => ({ title, data }));

  const listPadding = useListBottomPadding();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <View style={[styles.headerWrap, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerClip}>
          <AppHeader
            title="Notificações"
            left={<View style={{ width: 44 }} />}
            gradient={gradients.patientHeader}
            skipSafeAreaTop
            right={notifications.some(n => !n.read) ? (
              <TouchableOpacity
                onPress={handleMarkAllRead}
                style={styles.markAllBtn}
                accessibilityRole="button"
                accessibilityLabel="Marcar todas notificações como lidas"
              >
                <Text style={styles.markAll}>Marcar lidas</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 44 }} />
            )}
          />
        </View>
      </View>
      <TopSummaryStrip
        items={[
          { label: 'Total', value: counts.all },
          { label: 'Não lidas', value: unreadCount },
          { label: 'Pagamentos', value: counts.payment },
        ]}
      />

      <AppSegmentedControl
        items={FILTER_ITEMS.map((item) => ({
          key: item.key,
          label: item.label,
          count: (counts as any)[item.key] ?? undefined,
        }))}
        value={activeFilter}
        onValueChange={(value) => {
          haptics.selection();
          setActiveFilter(value as NotificationFilterKey);
        }}
        size="sm"
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <SkeletonList count={5} />
        </View>
      ) : error ? (
        <View style={styles.loadingWrap}>
          <AppEmptyState
            icon="alert-circle-outline"
            title="Não foi possível carregar"
            subtitle="Verifique sua conexão e tente novamente"
            actionLabel="Tentar novamente"
            onAction={loadData}
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={({ item }) => renderItem({ item })}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.groupLabel}>{title}</Text>
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: listPadding }]}
          ItemSeparatorComponent={ListSeparator}
          SectionSeparatorComponent={SectionGap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <AppEmptyState
              icon="notifications-off-outline"
              title={activeFilter === 'all' ? 'Você está em dia!' : 'Nada nesse filtro'}
              subtitle={activeFilter === 'all' ? 'Nenhuma novidade no momento' : 'Tente outro filtro para ver mais alertas.'}
            />
          }
        />
      )}
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerWrap: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingBottom: 8,
  },
  headerClip: {
    borderRadius: 22,
    overflow: 'hidden',
  },

  markAllBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  markAll: { fontSize: 13, color: colors.white, fontWeight: '600' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: uiTokens.screenPaddingHorizontal, paddingTop: 6 },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionGap: { height: spacing.sm },
  separator: { height: spacing.sm },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    alignItems: 'center',
  },
  cardUnread: {
    backgroundColor: colors.primarySoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  cardTitleUnread: {
    fontWeight: '700',
  },
  cardMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  urgencyBadge: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  urgencyBadgeHigh: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  urgencyTextHigh: {
    color: colors.error,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    flexShrink: 0,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 64,
    gap: spacing.sm,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySubtitle: { fontSize: 14, color: colors.textMuted },
  });
}
