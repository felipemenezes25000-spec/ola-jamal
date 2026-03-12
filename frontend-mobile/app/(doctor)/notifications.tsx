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
import { useListBottomPadding, useResponsive } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/api';
import { NotificationResponseDto } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { AppSegmentedControl, AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { showToast } from '../../components/ui/Toast';
import { haptics } from '../../lib/haptics';
import { NotificationCard } from '../../components/doctor/NotificationCard';
import type { NotificationVisual } from '../../components/doctor/NotificationCard';
import { motionTokens } from '../../lib/ui/motion';
import { timeAgoShort, getDateGroupForSection } from '../../lib/utils/format';

// ── Helpers ─────────────────────────────────────────────────────

type AlertCategory = 'new_request' | 'payment' | 'consultation' | 'system';

function getAlertCategory(item: NotificationResponseDto): AlertCategory {
  const type = ((item.data?.type as string) || '').toLowerCase();
  const status = ((item.data?.status as string) || '').toLowerCase();
  const t = (item.title || '').toLowerCase();

  if (type.includes('consultation') || type.includes('doctor_ready') || type.includes('no_show') ||
      t.includes('consulta') || status.includes('consultation')) {
    return 'consultation';
  }
  if (type.includes('payment') || type.includes('paid') || status === 'paid' ||
      t.includes('pagamento') || t.includes('pago')) {
    return 'payment';
  }
  if (type.includes('new_request') || type.includes('request_assigned') || type.includes('request_status') ||
      t.includes('solicitação') || t.includes('pedido') || t.includes('nova')) {
    return 'new_request';
  }
  return 'system';
}

function getDoctorVisual(item: NotificationResponseDto, colors: DesignColors): NotificationVisual {
  const type = ((item.data?.type as string) || '').toLowerCase();
  const status = ((item.data?.status as string) || '').toLowerCase();

  if (type.includes('new_request') || type.includes('request_assigned'))
    return { icon: 'document-text', color: colors.info, label: 'Novo pedido' };
  if (type.includes('signing_failed'))
    return { icon: 'alert-circle', color: colors.error, label: 'Falha assinatura' };
  if (status === 'paid' || type.includes('paid'))
    return { icon: 'card', color: colors.success, label: 'Pago' };
  if (type.includes('consultation'))
    return { icon: 'videocam', color: colors.accent, label: 'Consulta' };
  if (type.includes('reminder'))
    return { icon: 'alarm', color: colors.warning, label: 'Lembrete' };
  return { icon: 'notifications', color: colors.primary, label: 'Alerta' };
}

const ListSeparator = () => <View style={{ height: 8 }} />;
const SectionGap = () => <View style={{ height: 4 }} />;

export default function DoctorNotifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { user } = useAuth();
  const { refreshUnreadCount } = useNotifications();
  const [allNotifications, setAllNotifications] = useState<NotificationResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | AlertCategory>('all');

  const { colors, gradients, scheme } = useAppTheme({ role: 'doctor' });
  const isDark = scheme === 'dark';
  const { screenPad } = useResponsive();
  const styles = useMemo(() => makeStyles(colors, screenPad), [colors, screenPad]);

  const headerPaddingTop = insets.top + 16;
  const horizontalPad = screenPad;

  const notifications = useMemo(() => {
    return allNotifications.filter((n) => {
      const targetRole = n.data?.targetRole as string | undefined;
      if (targetRole && targetRole !== 'doctor') return false;
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
      const data = await getNotifications({ page: 1, pageSize: 50 });
      setAllNotifications(data.items || []);
      if (withFeedback) showToast({ message: 'Alertas atualizados', type: 'success' });
    } catch (e: unknown) {
      if ((e as { status?: number })?.status !== 401) console.error(e);
      if (withFeedback) showToast({ message: 'Não foi possível atualizar', type: 'error' });
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

  const handleMarkRead = async (id: string, item?: NotificationResponseDto) => {
    try {
      await markNotificationRead(id);
      setAllNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      refreshUnreadCount();
      haptics.selection();

      const deepLink = item?.data?.deepLink as string | undefined;
      const requestId = item?.data?.requestId as string | undefined;

      if (typeof deepLink === 'string' && deepLink.includes('/')) {
        router.push(deepLink.replace('renoveja://', '/') as Parameters<typeof router.push>[0]);
      } else if (requestId) {
        router.push(`/doctor-request/${requestId}`);
      }
    } catch (e) {
      console.warn('Failed to mark notification as read:', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setAllNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      refreshUnreadCount();
      haptics.success();
      showToast({ message: 'Todos marcados como lidos', type: 'success' });
    } catch (e) {
      console.warn('Failed to mark all notifications as read:', e);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const categoryCounts = useMemo(() => ({
    new_request: notifications.filter((n) => getAlertCategory(n) === 'new_request').length,
    payment: notifications.filter((n) => getAlertCategory(n) === 'payment').length,
    consultation: notifications.filter((n) => getAlertCategory(n) === 'consultation').length,
    system: notifications.filter((n) => getAlertCategory(n) === 'system').length,
  }), [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter((n) => getAlertCategory(n) === activeFilter);
  }, [activeFilter, notifications]);

  const groupedByDate = filteredNotifications.reduce<Record<string, NotificationResponseDto[]>>(
    (acc, n) => {
      const g = getDateGroupForSection(n.createdAt);
      if (!acc[g]) acc[g] = [];
      acc[g].push(n);
      return acc;
    },
    {}
  );
  const sections = Object.entries(groupedByDate).map(([title, data]) => ({ title, data }));

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* ── HEADER ── */}
      <LinearGradient
        colors={gradients.doctorHeader as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: headerPaddingTop, paddingHorizontal: horizontalPad }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.title, { color: colors.headerOverlayText }]}>Alertas</Text>
              {unreadCount > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.subtitle, { color: colors.headerOverlayTextMuted }]}>
              {unreadCount > 0 ? `${unreadCount} não lido${unreadCount > 1 ? 's' : ''}` : 'Tudo em dia'}
            </Text>
          </View>

          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              style={[styles.markAllBtn, { backgroundColor: colors.headerOverlaySurface, borderColor: colors.headerOverlayBorder }]}
              accessibilityRole="button"
              accessibilityLabel="Marcar todas como lidas"
            >
              <Ionicons name="checkmark-done" size={18} color={colors.headerOverlayText} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ── FILTROS ── */}
      <View style={styles.filterSection}>
        <AppSegmentedControl
          items={[
            { key: 'all', label: 'Todos', count: notifications.length },
            { key: 'new_request', label: 'Pedidos', count: categoryCounts.new_request },
            { key: 'payment', label: 'Pagamentos', count: categoryCounts.payment },
            { key: 'consultation', label: 'Consultas', count: categoryCounts.consultation },
          ]}
          value={activeFilter}
          onValueChange={(value) => {
            haptics.selection();
            setActiveFilter(value as 'all' | AlertCategory);
          }}
          size="sm"
          scrollable
          role="doctor"
        />
      </View>

      {/* ── LISTA ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <SkeletonList count={5} />
        </View>
      ) : (
        <FadeIn visible {...motionTokens.fade.listDoctor} delay={20} fill>
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <FadeIn
                visible
                duration={200}
                fromY={6}
                delay={index * 20}
                fill={false}
              >
                <NotificationCard
                  item={item}
                  visual={getDoctorVisual(item, colors)}
                  colors={colors}
                  isDark={isDark}
                  onPress={() => handleMarkRead(item.id, item)}
                  timeAgo={timeAgoShort(item.createdAt)}
                />
              </FadeIn>
            )}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{title}</Text>
            )}
            contentContainerStyle={[styles.listContent, { paddingBottom: listPadding }]}
            ItemSeparatorComponent={ListSeparator}
            SectionSeparatorComponent={SectionGap}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <AppEmptyState
                icon="notifications-off-outline"
                title={activeFilter === 'all' ? 'Você está em dia' : 'Nenhum alerta'}
                subtitle={
                  activeFilter === 'all'
                    ? 'Nenhuma novidade no momento.'
                    : 'Tente outro filtro para ver mais alertas.'
                }
              />
            }
          />
        </FadeIn>
      )}
    </View>
  );
}

function makeStyles(colors: DesignColors, pad: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingBottom: 20,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: { flex: 1, minWidth: 0 },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    unreadBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.white,
      letterSpacing: 0.2,
    },
    subtitle: {
      fontSize: 13,
      fontWeight: '500',
      marginTop: 3,
    },
    markAllBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginLeft: 12,
      flexShrink: 0,
    },
    filterSection: {
      paddingTop: 14,
      paddingBottom: 4,
    },
    listContent: {
      paddingHorizontal: pad,
      paddingTop: 12,
    },
    groupLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      marginTop: 20,
      marginBottom: 8,
    },
    loadingWrap: {
      flex: 1,
      paddingHorizontal: pad,
      paddingTop: 16,
    },
  });
}
