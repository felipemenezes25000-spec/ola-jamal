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
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { uiTokens } from '../../lib/ui/tokens';
import { getNotifications, markNotificationAsRead } from '../../lib/api';
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
import { getDateGroupForSection, timeAgoShort } from '../../lib/utils/format';

// ── Helpers ────────────────────────────────────────────────────

type NotificationFilterKey = 'all' | 'request' | 'consultation';

/** Categoriza notificação para filtros do paciente */
function categorizeNotification(item: NotificationResponseDto): Exclude<NotificationFilterKey, 'all'> {
  const t = (item.title || '').toLowerCase();
  const data = item.data || {};
  const status = (data.status as string || '').toLowerCase();
  const type = (data.type as string || '').toLowerCase();

  // Consultas
  if (type.includes('consultation') || type.includes('doctor_ready') || type.includes('no_show') ||
      t.includes('consulta') || t.includes('médico') || t.includes('videochamada') || status.includes('consultation')) {
    return 'consultation';
  }

  return 'request';
}

/** Ícone e cor por tipo de evento — visual para o paciente */
function getPatientVisual(item: NotificationResponseDto, colors: DesignColors): NotificationVisual {
  const type = (item.data?.type as string || '').toLowerCase();
  const status = (item.data?.status as string || '').toLowerCase();

  // Documento pronto — Green
  if (type.includes('signed') || status === 'signed' || (item.data?.documentAvailable)) {
    return { icon: 'document-text', color: '#22C55E', label: 'Pronto' };
  }
  // Consulta — Purple
  if (type.includes('consultation') || type.includes('doctor_ready')) {
    return { icon: 'videocam', color: '#8B5CF6', label: 'Consulta' };
  }
  // Aprovado — Blue
  if (status === 'approved') {
    return { icon: 'thumbs-up', color: '#0EA5E9', label: 'Aprovado' };
  }
  // Em análise — Blue
  if (status === 'inreview' || status === 'submitted') {
    return { icon: 'hourglass', color: '#0EA5E9', label: 'Em análise' };
  }
  // Rejeitado — Error
  if (status === 'rejected') {
    return { icon: 'close-circle', color: '#EF4444', label: 'Revisão' };
  }
  // Cancelado
  if (status === 'cancelled') {
    return { icon: 'ban', color: colors.textMuted, label: 'Cancelado' };
  }
  // Lembrete — Yellow
  if (type.includes('reminder')) {
    return { icon: 'alarm', color: '#F59E0B', label: 'Lembrete' };
  }

  // Padrão — Blue (request update)
  return { icon: 'notifications', color: '#0EA5E9', label: 'Atualização' };
}

const FILTER_ITEMS: { key: NotificationFilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'request', label: 'Pedidos' },
  { key: 'consultation', label: 'Consultas' },
];

const ListSeparator = () => <View style={{ height: 8 }} />;
const SectionGap = () => <View style={{ height: 4 }} />;

const pad = uiTokens.screenPaddingHorizontal;

export default function PatientNotifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { user } = useAuth();
  const { refreshUnreadCount, markAllReadOptimistic, decrementUnreadCount } = useNotifications();
  const [allNotifications, setAllNotifications] = useState<NotificationResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotificationFilterKey>('all');

  const { colors, scheme } = useAppTheme();
  const isDark = scheme === 'dark';
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

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

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const counts = useMemo(() => ({
    all: notifications.length,
    request: notifications.filter(n => categorizeNotification(n) === 'request').length,
    consultation: notifications.filter(n => categorizeNotification(n) === 'consultation').length,
  }), [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter(n => categorizeNotification(n) === activeFilter);
  }, [activeFilter, notifications]);

  const sections = useMemo(() => {
    const grouped = filteredNotifications.reduce<Record<string, NotificationResponseDto[]>>((acc, n) => {
      const g = getDateGroupForSection(n.createdAt);
      if (!acc[g]) acc[g] = [];
      acc[g].push(n);
      return acc;
    }, {});
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [filteredNotifications]);

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Notificações</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              style={styles.markAllBtn}
              accessibilityRole="button"
              accessibilityLabel="Marcar todas notificações como lidas"
            >
              <Ionicons name="checkmark-done" size={16} color={colors.primary} />
              <Text style={styles.markAllText}>Ler todas</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── FILTROS ── */}
      <View style={styles.filtersWrap}>
        <AppSegmentedControl
          items={FILTER_ITEMS.map(item => ({
            key: item.key,
            label: item.label,
            count: (counts as Record<string, number>)[item.key] ?? undefined,
          }))}
          value={activeFilter}
          onValueChange={(value) => {
            haptics.selection();
            setActiveFilter(value as NotificationFilterKey);
          }}
          size="sm"
          scrollable
        />
      </View>

      {/* ── LISTA ── */}
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
        <FadeIn visible {...motionTokens.fade.listPatient} delay={20} fill>
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            renderItem={({ item, index }) => (
              <FadeIn visible duration={200} fromY={6} delay={index * 35} fill={false}>
                <NotificationCard
                  item={item}
                  visual={getPatientVisual(item, colors)}
                  colors={colors}
                  isDark={isDark}
                  onPress={() => handleMarkRead(item.id, item)}
                  timeAgo={timeAgoShort(item.createdAt)}
                />
              </FadeIn>
            )}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={styles.groupLabel}>{title}</Text>
            )}
            contentContainerStyle={[styles.listContent, { paddingBottom: listPadding }]}
            ItemSeparatorComponent={ListSeparator}
            SectionSeparatorComponent={SectionGap}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <AppEmptyState
                icon="notifications-off-outline"
                title={activeFilter === 'all' ? 'Você está em dia!' : 'Nada nesse filtro'}
                subtitle={activeFilter === 'all' ? 'Nenhuma novidade no momento' : 'Tente outro filtro para ver mais alertas.'}
              />
            }
          />
        </FadeIn>
      )}
    </View>
  );
}

function makeStyles(colors: DesignColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : '#F8FAFC',
    },
    header: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      paddingHorizontal: pad,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : '#F1F5F9',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#EF4444',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    unreadBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    markAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: isDark ? `${colors.primary}14` : '#F0F9FF',
    },
    markAllText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    filtersWrap: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : '#F1F5F9',
    },
    loadingWrap: {
      flex: 1,
      paddingHorizontal: pad,
      paddingTop: 16,
    },
    listContent: {
      paddingHorizontal: pad,
      paddingTop: 8,
    },
    groupLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.0,
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginTop: 20,
      marginBottom: 8,
    },
  });
}
