import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, doctorDS } from '../../lib/themeDoctor';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/api';
import { NotificationResponseDto } from '../../types/database';
import { useNotifications } from '../../contexts/NotificationContext';
import { AppSegmentedControl, AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { showToast } from '../../components/ui/Toast';
import { haptics } from '../../lib/haptics';

function getNotificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'success': return 'checkmark-circle';
    case 'warning': return 'warning';
    case 'error': return 'alert-circle';
    default: return 'notifications';
  }
}

function getNotificationColor(colors: DesignColors, type: string): string {
  switch (type) {
    case 'success': return colors.success;
    case 'warning': return colors.warning;
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

const ListSeparator = () => <View style={{ height: 8 }} />;
const SectionGap = () => <View style={{ height: 4 }} />;

export default function DoctorNotifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { refreshUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<NotificationResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | AlertCategory>('all');

  const { colors, gradients } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const headerPaddingTop = insets.top + 16;
  const horizontalPad = doctorDS.screenPaddingHorizontal;

  const loadData = useCallback(async (withFeedback = false) => {
    try {
      const data = await getNotifications({ page: 1, pageSize: 50 });
      setNotifications(data.items || []);
      if (withFeedback) {
        showToast({ message: 'Alertas atualizados', type: 'success' });
      }
    } catch (e: unknown) {
      if ((e as { status?: number })?.status !== 401) console.error(e);
      if (withFeedback) {
        showToast({ message: 'Não foi possível atualizar os alertas', type: 'error' });
      }
    }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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

  const handleMarkRead = async (id: string, item?: NotificationResponseDto) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      refreshUnreadCount();
      haptics.selection();
      const requestId = item?.data?.requestId as string | undefined;
      if (requestId) {
        router.push(`/doctor-request/${requestId}`);
      }
    } catch (e) { console.warn('Failed to mark notification as read:', e); }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      refreshUnreadCount();
      haptics.success();
      showToast({ message: 'Alertas marcados como lidos', type: 'success' });
    } catch (e) { console.warn('Failed to mark all notifications as read:', e); }
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

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return byCategory[activeFilter];
  }, [activeFilter, byCategory, notifications]);

  const groupedByDate = filteredNotifications.reduce<Record<string, NotificationResponseDto[]>>((acc, n) => {
    const g = getDateGroup(n.createdAt);
    if (!acc[g]) acc[g] = [];
    acc[g].push(n);
    return acc;
  }, {});
  const sections = Object.entries(groupedByDate).map(([title, data]) => ({ title, data }));

  const renderItem = ({ item }: { item: NotificationResponseDto }) => {
    const iconColor = getNotificationColor(colors, item.notificationType);
    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => handleMarkRead(item.id, item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Notificação: ${item.title}`}
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
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={gradients.doctorHeader as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: headerPaddingTop, paddingHorizontal: horizontalPad }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Alertas</Text>
            <Text style={styles.subtitle}>Notificações e atualizações</Text>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              style={styles.markAllBtn}
              accessibilityRole="button"
              accessibilityLabel="Marcar todas como lidas"
            >
              <Text style={styles.markAllText}>Marcar lidas</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.contentSection}>
        <AppSegmentedControl
          items={[
            { key: 'all', label: 'Todos', count: notifications.length },
            { key: 'payment', label: 'Pagamentos', count: categoryCounts.payment },
            { key: 'new_request', label: 'Solicitações', count: categoryCounts.new_request },
            { key: 'other', label: 'Outros', count: categoryCounts.other },
          ]}
          value={activeFilter}
          onValueChange={(value) => {
            haptics.selection();
            setActiveFilter(value as 'all' | AlertCategory);
          }}
          size="sm"
          scrollable
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <SkeletonList count={5} />
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
              title={activeFilter === 'all' ? 'Você está em dia' : 'Nenhum alerta nesse filtro'}
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
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingBottom: 18,
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
    fontSize: 20,
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
  contentSection: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  categoryChip: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  markAllBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
  },
  markAllText: { fontSize: 12, fontFamily: typography.fontFamily.bold, color: colors.white, fontWeight: '700', letterSpacing: 0.2 },
  listContent: {
    paddingHorizontal: doctorDS.screenPaddingHorizontal,
    paddingTop: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  cardUnread: {
    backgroundColor: colors.primarySoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.text },
  cardTitleUnread: { fontWeight: '700' },
  cardMessage: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  cardTime: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textMuted, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    flexShrink: 0,
    alignSelf: 'center',
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.2,
    marginTop: spacing.lg,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 14, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.2 },
  emptySubtitle: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textMuted },
  });
}
