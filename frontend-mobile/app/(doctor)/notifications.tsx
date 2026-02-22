import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, gradients, doctorDS } from '../../lib/themeDoctor';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/api';
import { NotificationResponseDto } from '../../types/database';
import { useNotifications } from '../../contexts/NotificationContext';

function getNotificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'success': return 'checkmark-circle';
    case 'warning': return 'warning';
    case 'error': return 'alert-circle';
    default: return 'notifications';
  }
}

function getNotificationColor(type: string): string {
  switch (type) {
    case 'success': return colors.success;
    case 'warning': return '#F59E0B';
    case 'error': return colors.error;
    default: return colors.primary;
  }
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'Agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

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

/** Agrupa notificações por tipo para o médico: Pagamentos | Novas solicitações | Outros */
type AlertCategory = 'payment' | 'new_request' | 'other';
function getAlertCategory(item: NotificationResponseDto): AlertCategory {
  const t = (item.title || '').toLowerCase();
  const m = (item.message || '').toLowerCase();
  const data = item.data || {};
  if (data.paymentId != null || t.includes('pagamento') || t.includes('pago') || m.includes('pagamento') || m.includes('pago')) return 'payment';
  if (t.includes('solicitação') || t.includes('pedido') || t.includes('novo') || m.includes('solicitação') || m.includes('pedido') || m.includes('novo')) return 'new_request';
  return 'other';
}

const ALERT_CATEGORY_LABELS: Record<AlertCategory, string> = {
  payment: 'Pagamentos',
  new_request: 'Novas solicitações',
  other: 'Outros',
};

export default function DoctorNotifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { refreshUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<NotificationResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headerPaddingTop = insets.top + 16;
  const horizontalPad = doctorDS.screenPaddingHorizontal;

  const loadData = useCallback(async () => {
    try {
      const data = await getNotifications({ page: 1, pageSize: 50 });
      setNotifications(data.items || []);
    } catch (e: any) { if (e?.status !== 401) console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      refreshUnreadCount();
    }, [loadData, refreshUnreadCount])
  );

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleMarkRead = async (id: string, item?: NotificationResponseDto) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      refreshUnreadCount();
      const requestId = item?.data?.requestId;
      if (requestId) {
        router.push(`/doctor-request/${requestId}`);
      }
    } catch { }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      refreshUnreadCount();
    } catch { }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const byCategory = notifications.reduce<Record<AlertCategory, NotificationResponseDto[]>>(
    (acc, n) => {
      const cat = getAlertCategory(n);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(n);
      return acc;
    },
    { payment: [], new_request: [], other: [] } as Record<AlertCategory, NotificationResponseDto[]>
  );
  const categoryCounts = {
    payment: byCategory.payment.length,
    new_request: byCategory.new_request.length,
    other: byCategory.other.length,
  };

  const groupedByDate = notifications.reduce<Record<string, NotificationResponseDto[]>>((acc, n) => {
    const g = getDateGroup(n.createdAt);
    if (!acc[g]) acc[g] = [];
    acc[g].push(n);
    return acc;
  }, {});
  const sections = Object.entries(groupedByDate).map(([title, data]) => ({ title, data }));

  const renderItem = ({ item }: { item: NotificationResponseDto }) => {
    const iconColor = getNotificationColor(item.notificationType);
    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => handleMarkRead(item.id, item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
          <Ionicons name={getNotificationIcon(item.notificationType)} size={22} color={iconColor} />
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...gradients.doctorHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: headerPaddingTop, paddingHorizontal: horizontalPad }]}
      >
        <Text style={styles.title}>Alertas</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Marcar lidas</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {(categoryCounts.payment > 0 || categoryCounts.new_request > 0 || categoryCounts.other > 0) && (
        <View style={styles.categoryRow}>
          {categoryCounts.payment > 0 && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>Pagamentos ({categoryCounts.payment})</Text>
            </View>
          )}
          {categoryCounts.new_request > 0 && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>Novas solicitações ({categoryCounts.new_request})</Text>
            </View>
          )}
          {categoryCounts.other > 0 && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>Outros ({categoryCounts.other})</Text>
            </View>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
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
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Você está em dia!</Text>
              <Text style={styles.emptySubtitle}>Nenhuma novidade no momento</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 28,
  },
  title: { fontSize: 22, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: '#fff' },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: doctorDS.screenPaddingHorizontal,
    paddingBottom: spacing.md,
  },
  categoryChip: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  markAllBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  markAllText: { fontSize: 13, fontFamily: typography.fontFamily.semibold, color: '#fff', fontWeight: '600' },
  listContent: {
    paddingHorizontal: doctorDS.screenPaddingHorizontal,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: doctorDS.cardRadius,
    padding: spacing.md,
  },
  cardUnread: {
    backgroundColor: colors.primarySoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.text },
  cardTitleUnread: { fontWeight: '700' },
  cardMessage: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  cardTime: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textMuted, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionGap: { height: spacing.sm },
  separator: { height: spacing.sm },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: {
    alignItems: 'center',
    paddingTop: 64,
    gap: spacing.sm,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.textSecondary },
  emptySubtitle: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textMuted },
});
