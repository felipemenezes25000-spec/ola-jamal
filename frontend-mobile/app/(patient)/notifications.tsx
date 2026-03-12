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
import { nav } from '../../lib/navigation';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding, useResponsive } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { getNotifications, markNotificationAsRead } from '../../lib/api';
import { NotificationResponseDto } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { AppHeader, AppSegmentedControl, AppEmptyState, TopSummaryStrip } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { showToast } from '../../components/ui/Toast';
import { haptics } from '../../lib/haptics';
import { getDateGroupForSection, timeAgoShort } from '../../lib/utils/format';

// ── Helpers ────────────────────────────────────────────────────

type NotificationFilterKey = 'all' | 'payment' | 'request' | 'consultation';

/** Categoriza notificação para filtros do paciente */
function categorizeNotification(item: NotificationResponseDto): Exclude<NotificationFilterKey, 'all'> {
  const t = (item.title || '').toLowerCase();
  const m = (item.message || '').toLowerCase();
  const data = item.data || {};
  const status = (data.status as string || '').toLowerCase();
  const type = (data.type as string || '').toLowerCase();

  // Consultas
  if (type.includes('consultation') || type.includes('doctor_ready') || type.includes('no_show') ||
      t.includes('consulta') || t.includes('médico') || t.includes('videochamada') || status.includes('consultation')) {
    return 'consultation';
  }

  // Pagamentos
  if (data.paymentId != null || type.includes('payment') ||
      t.includes('pagamento') || m.includes('pagamento') || t.includes('pago') || m.includes('pago') ||
      status === 'approvedpendingpayment' || status === 'paid') {
    return 'payment';
  }

  return 'request';
}

/** Ícone e cor por tipo de evento — mais expressivo para o paciente */
function getNotificationVisual(item: NotificationResponseDto, colors: DesignColors): {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  label: string;
} {
  const type = (item.data?.type as string || '').toLowerCase();
  const status = (item.data?.status as string || '').toLowerCase();

  // Documento pronto
  if (type.includes('signed') || status === 'signed' || (item.data?.documentAvailable)) {
    return { icon: 'document-text', color: colors.success, bgColor: colors.successLight, label: 'Pronto' };
  }
  // Consulta
  if (type.includes('consultation') || type.includes('doctor_ready')) {
    return { icon: 'videocam', color: colors.accent, bgColor: colors.accentSoft, label: 'Consulta' };
  }
  // Pagamento confirmado
  if (status === 'paid') {
    return { icon: 'checkmark-circle', color: colors.success, bgColor: colors.successLight, label: 'Pago' };
  }
  // Pagamento pendente / falha
  if (type.includes('payment') || status === 'approvedpendingpayment') {
    return { icon: 'card', color: colors.warning, bgColor: colors.warningLight, label: 'Pagamento' };
  }
  // Aprovado
  if (status === 'approvedpendingpayment') {
    return { icon: 'thumbs-up', color: colors.info, bgColor: colors.infoLight, label: 'Aprovado' };
  }
  // Em análise
  if (status === 'inreview' || status === 'submitted') {
    return { icon: 'hourglass', color: colors.info, bgColor: colors.infoLight, label: 'Em análise' };
  }
  // Rejeitado
  if (status === 'rejected') {
    return { icon: 'close-circle', color: colors.error, bgColor: colors.errorLight, label: 'Revisão' };
  }
  // Cancelado
  if (status === 'cancelled') {
    return { icon: 'ban', color: colors.textMuted, bgColor: colors.surfaceSecondary, label: 'Cancelado' };
  }
  // Lembrete
  if (type.includes('reminder')) {
    return { icon: 'alarm', color: colors.warning, bgColor: colors.warningLight, label: 'Lembrete' };
  }

  // Padrão
  return { icon: 'notifications', color: colors.primary, bgColor: colors.primarySoft, label: 'Atualização' };
}

const FILTER_ITEMS: { key: NotificationFilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'request', label: 'Pedidos' },
  { key: 'payment', label: 'Pagamentos' },
  { key: 'consultation', label: 'Consultas' },
];

const ListSeparator = () => <View style={{ height: 10 }} />;
const SectionGap = () => <View style={{ height: 6 }} />;

export default function PatientNotifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refreshUnreadCount, markAllReadOptimistic, decrementUnreadCount } = useNotifications();
  const [allNotifications, setAllNotifications] = useState<NotificationResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotificationFilterKey>('all');

  const { colors, gradients, scheme } = useAppTheme();
  const isDark = scheme === 'dark';
  const { screenPad, rs } = useResponsive();
  const styles = useMemo(() => makeStyles(colors, isDark, screenPad, rs), [colors, isDark, screenPad, rs]);

  // ── FILTRO POR ROLE: só mostra notificações destinadas ao paciente ──
  const notifications = useMemo(() => {
    return allNotifications.filter(n => {
      const targetRole = n.data?.targetRole as string | undefined;
      if (targetRole && targetRole !== 'patient') return false;
      // Oculta notificações de teste de push (ex.: "Teste RenoveJá")
      const type = (n.data?.type as string) || '';
      if (type.toLowerCase() === 'test') return false;
      const title = (n.title || '').toLowerCase();
      if (title.includes('teste renove')) return false;
      return true;
    });
  }, [allNotifications]);

  const loadData = useCallback(async (withFeedback = false) => {
    if (!user?.id) return;
    try {
      setError(false);
      const response = await getNotifications({ page: 1, pageSize: 50 });
      setAllNotifications(response.items || []);
      if (withFeedback) {
        showToast({ message: 'Notificações atualizadas', type: 'success' });
      }
    } catch {
      setError(true);
      showToast({
        message: withFeedback ? 'Não foi possível atualizar as notificações' : 'Não foi possível carregar as notificações. Tente novamente.',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) loadData();
    else setLoading(false);
  }, [loadData, user?.id]);

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
      setAllNotifications(prev => prev.map(n => ({ ...n, read: true })));
      await markAllReadOptimistic();
      haptics.success();
      showToast({ message: 'Todas marcadas como lidas', type: 'success' });
    } catch {
      haptics.error();
      showToast({ message: 'Não foi possível marcar todas como lidas', type: 'error' });
    }
  };

  const handleMarkRead = async (id: string, item?: NotificationResponseDto) => {
    decrementUnreadCount();
    setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await markNotificationAsRead(id);
      haptics.selection();

      // ── NAVEGAÇÃO INTELIGENTE: usar deepLink se disponível ──
      const deepLink = item?.data?.deepLink as string | undefined;
      const requestId = item?.data?.requestId as string | undefined;

      if (typeof deepLink === 'string' && deepLink.includes('/')) {
        // Extrair path do deepLink (renoveja://request-detail/xxx → /request-detail/xxx)
        const path = deepLink.replace('renoveja://', '/');
        nav.push(router, path as any);
      } else if (requestId) {
        router.push(`/request-detail/${requestId}`);
      }
    } catch {
      refreshUnreadCount();
      showToast({ message: 'Não foi possível marcar como lida', type: 'error' });
    }
  };

  const renderItem = ({ item }: { item: NotificationResponseDto }) => {
    const visual = getNotificationVisual(item, colors);

    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => handleMarkRead(item.id, item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Notificação: ${item.title}`}
      >
        <View style={[styles.iconContainer, { backgroundColor: isDark ? visual.color + '20' : visual.bgColor }]}>
          <Ionicons name={visual.icon} size={20} color={visual.color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.cardMessage} numberOfLines={2}>{item.message}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.cardDate}>{timeAgoShort(item.createdAt)}</Text>
            <View style={[styles.categoryBadge, { backgroundColor: isDark ? visual.color + '15' : visual.bgColor }]}>
              <Text style={[styles.categoryText, { color: visual.color }]}>{visual.label}</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    );
  };

  const counts = useMemo(() => {
    const all = notifications.length;
    const payment = notifications.filter((n) => categorizeNotification(n) === 'payment').length;
    const request = notifications.filter((n) => categorizeNotification(n) === 'request').length;
    const consultation = notifications.filter((n) => categorizeNotification(n) === 'consultation').length;
    return { all, payment, request, consultation };
  }, [notifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter((n) => categorizeNotification(n) === activeFilter);
  }, [activeFilter, notifications]);

  const sections = Object.entries(
    filteredNotifications.reduce<Record<string, NotificationResponseDto[]>>((acc, n) => {
      const g = getDateGroupForSection(n.createdAt);
      if (!acc[g]) acc[g] = [];
      acc[g].push(n);
      return acc;
    }, {})
  ).map(([title, data]) => ({ title, data }));

  const listPadding = useListBottomPadding();

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />
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
                <Ionicons name="checkmark-done" size={18} color={colors.white} />
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
          { label: 'Consultas', value: counts.consultation },
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

function makeStyles(colors: DesignColors, isDark: boolean, screenPad: number, rs: (v: number) => number) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerWrap: {
    paddingHorizontal: screenPad,
    paddingBottom: 8,
  },
  headerClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  markAllBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: screenPad, paddingTop: 6 },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? colors.border : 'transparent',
    shadowColor: isDark ? 'transparent' : '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: isDark ? 0 : 2,
  },
  cardUnread: {
    backgroundColor: colors.primarySoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  iconContainer: {
    width: rs(38),
    height: rs(38),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  cardTitleUnread: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
  cardMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardDate: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  categoryBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  });
}
