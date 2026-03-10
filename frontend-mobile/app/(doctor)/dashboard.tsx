import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Animated,
  ListRenderItem,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { useAuth } from '../../contexts/AuthContext';
import { useRequestsEvents } from '../../contexts/RequestsEventsContext';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { getRequests, getActiveCertificate } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { cacheRequest } from '../../lib/requestCache';

import { AppEmptyState, SectionHeader } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { QueueItem } from '../../components/doctor/QueueItem';

import {
  countPendentes,
  getPendingForPanel,
} from '../../lib/domain/getRequestUiState';
import { haptics } from '../../lib/haptics';
import { showToast } from '../../components/ui/Toast';
import { motionTokens } from '../../lib/ui/motion';

const SCREEN_PAD = 20;

function isValidRequestItem(value: unknown): value is RequestResponseDto {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RequestResponseDto>;
  return typeof candidate.id === 'string' && candidate.id.length > 0 && typeof candidate.status === 'string';
}

// ─── Helpers ────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function sanitizeDoctorName(name: string): { displayFirst: string; greetingName: string } {
  const raw = name.trim().split(/\s+/).filter(Boolean);
  const prefixes = ['dr', 'dr.', 'dra', 'dra.'];
  const first = raw[0] ?? '';
  const isPrefix = prefixes.includes(first.toLowerCase().replace(/\.$/, ''));
  const displayFirst = isPrefix && raw.length > 1 ? raw[1] : first || 'Médico';
  const greetingName = displayFirst.toLowerCase().startsWith('dr') ? displayFirst : `Dr(a). ${displayFirst}`;
  return { displayFirst, greetingName };
}

// ─── MetricCard ─────────────────────────────────────────────────
interface MetricCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  color: string;
  bg: string;
  labelColor: string;
  delay: number;
}

const MetricCard = React.memo(function MetricCard({
  icon, value, label, color, bg, labelColor, delay,
}: MetricCardProps) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 120, friction: 7, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [scale, opacity, delay]);

  return (
    <Animated.View style={[styles.metricCard, { opacity, transform: [{ scale }] }]}>
      <View style={[styles.metricIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: labelColor }]}>{label}</Text>
    </Animated.View>
  );
});

// ─── QuickAction ────────────────────────────────────────────────
interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: DesignColors;
}

function QuickAction({ icon, label, onPress, colors }: QuickActionProps) {
  return (
    <Pressable
      onPress={() => { haptics.selection(); onPress(); }}
      style={({ pressed }) => [
        styles.quickAction,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
        },
        pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.quickActionLabel, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── CertificateAlert ───────────────────────────────────────────
function CertificateAlert({ colors, onPress }: { colors: DesignColors; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.certAlert, { backgroundColor: colors.warningLight, borderColor: colors.warning + '35' }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Configurar certificado digital"
    >
      <View style={[styles.certIconWrap, { backgroundColor: colors.warning + '22' }]}>
        <Ionicons name="shield-checkmark" size={20} color={colors.warning} />
      </View>
      <View style={styles.certText}>
        <Text style={[styles.certTitle, { color: colors.warning }]}>
          Certificado Digital pendente
        </Text>
        <Text style={[styles.certDesc, { color: colors.textSecondary }]}>
          Configure para assinar receitas digitalmente.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.warning} />
    </TouchableOpacity>
  );
}

// ═════════════════════════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════════════════════════
export default function DoctorDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors, gradients, shadows, borderRadius } = useAppTheme({ role: 'doctor' });

  const [queue, setQueue] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCertificate, setHasCertificate] = useState<boolean | null>(null);

  // ─── Data Loading ───────────────────────────────────────────
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = useCallback(async (withFeedback = false) => {
    try {
      const [cert, res] = await Promise.allSettled([
        getActiveCertificate(),
        getRequests({ page: 1, pageSize: 100 }), // reduced from 500 for performance
      ]);
      if (!mountedRef.current) return;
      setHasCertificate(cert.status === 'fulfilled' && !!cert.value);
      const rawItems = res.status === 'fulfilled' ? res.value?.items : undefined;
      const items = Array.isArray(rawItems) ? rawItems.filter(isValidRequestItem) : [];
      setQueue(items);
      if (withFeedback) showToast({ message: 'Painel atualizado', type: 'success' });
    } catch (e) {
      if (__DEV__) console.error('[DoctorDashboard] loadData error:', e);
      if (!mountedRef.current) return;
      if (withFeedback) showToast({ message: 'Erro ao atualizar', type: 'error' });
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const { subscribe, isConnected } = useRequestsEvents();

  useFocusEffect(
    useCallback(() => {
      loadData();
      if (!isConnected) {
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
      }
    }, [loadData, isConnected])
  );

  useEffect(() => {
    return subscribe(() => loadData());
  }, [subscribe, loadData]);

  const onRefresh = useCallback(() => {
    haptics.light();
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // ─── Derived Data ──────────────────────────────────────────
  const pendingList = useMemo(() => getPendingForPanel(queue, 15), [queue]);
  const stats = useMemo(() => {
    let pendentes = 0, done = 0, prescriptions = 0, consultations = 0, exams = 0;
    const doneStatuses = ['approved', 'signed', 'delivered'];
    for (const q of queue) {
      if (doneStatuses.includes(q.status)) done++;
      if (q.requestType === 'prescription') prescriptions++;
      if (q.requestType === 'consultation') consultations++;
      if (q.requestType === 'exam') exams++;
    }
    pendentes = countPendentes(queue);
    return { pendentes, done, prescriptions, consultations, exams };
  }, [queue]);

  const { displayFirst, greetingName } = useMemo(
    () => sanitizeDoctorName(user?.name || ''),
    [user?.name]
  );

  // ─── Gradiente seguro (evita crash se gradients.doctorHeader for undefined)
  const headerGradient = useMemo<[string, string, ...string[]]>(
    () => (Array.isArray(gradients?.doctorHeader) && gradients.doctorHeader.length > 0
      ? (gradients.doctorHeader as [string, string, ...string[]])
      : (['#0369A1', '#0EA5E9'] as [string, string, ...string[]])),
    [gradients?.doctorHeader]
  );

  const dateStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // ─── Hooks DEVEM vir antes de qualquer early return (Rules of Hooks) ───
  const handleQueueItemPress = useCallback(
    (item: RequestResponseDto) => {
      haptics.selection();
      cacheRequest(item);
      router.push(`/doctor-request/${item.id}`);
    },
    [router]
  );

  // ─── Queue Item Renderer ───────────────────────────────────
  const renderQueueItem: ListRenderItem<RequestResponseDto> = useCallback(
    ({ item, index }) => (
      <FadeIn key={item.id} visible duration={200} fromY={8} delay={index * 30} fill={false}>
        <QueueItem
          request={item}
          colors={colors}
          onPress={() => handleQueueItemPress(item)}
        />
      </FadeIn>
    ),
    [colors, handleQueueItemPress]
  );

  const keyExtractor = useCallback((item: RequestResponseDto) => item.id, []);

  // ─── Header Component (rendered inside FlatList) ───────────
  const ListHeader = useMemo(() => (
    <>
      {/* ── HEADER GRADIENT ── */}
      <LinearGradient
        colors={headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 24 }]}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: colors.headerOverlayTextMuted }]}>
              {getGreeting()},
            </Text>
            <Text style={[styles.doctorName, { color: colors.headerOverlayText }]} numberOfLines={1}>
              {greetingName}
            </Text>
            <Text style={[styles.date, { color: colors.headerOverlayTextSubtle }]}>
              {dateStr}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.avatarBtn, {
              backgroundColor: colors.headerOverlaySurface,
              borderColor: colors.headerOverlayBorder,
            }]}
            onPress={() => { haptics.selection(); router.push('/(doctor)/profile'); }}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
          >
            {user?.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={{ width: '100%', height: '100%', borderRadius: 24 }}
                resizeMode="cover"
              />
            ) : (
              <Text style={[styles.avatarInitials, { color: colors.headerOverlayText }]}>
                {(displayFirst[0] ?? 'M').toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Status pill */}
        <View style={[styles.statusPill, {
          backgroundColor: colors.headerOverlaySurface,
          borderColor: colors.headerOverlayBorder,
        }]}>
          <View style={[styles.onlineDot, {
            backgroundColor: isConnected ? colors.success : colors.warning,
          }]} />
          <Text style={[styles.statusText, { color: colors.headerOverlayTextMuted }]}>
            {isConnected ? 'Online' : 'Reconectando'} · {stats.pendentes > 0 ? `${stats.pendentes} aguardando` : 'Fila limpa'}
          </Text>
        </View>
      </LinearGradient>

      {/* ── MÉTRICAS ── */}
      <View style={styles.metricsSection}>
        <View style={[styles.metricsGrid, {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          ...shadows.card,
        }]}>
          <MetricCard
            icon="time"
            value={stats.pendentes}
            label="Pendentes"
            color={stats.pendentes > 0 ? colors.warning : colors.textMuted}
            bg={stats.pendentes > 0 ? colors.warningLight : colors.surfaceSecondary}
            labelColor={colors.textMuted}
            delay={60}
          />
          <View style={[styles.metricDivider, { backgroundColor: colors.borderLight }]} />
          <MetricCard
            icon="checkmark-circle"
            value={stats.done}
            label="Atendidos"
            color={colors.success}
            bg={colors.successLight}
            labelColor={colors.textMuted}
            delay={120}
          />
          <View style={[styles.metricDivider, { backgroundColor: colors.borderLight }]} />
          <MetricCard
            icon="document-text"
            value={stats.prescriptions}
            label="Receitas"
            color={colors.info}
            bg={colors.infoLight}
            labelColor={colors.textMuted}
            delay={180}
          />
          <View style={[styles.metricDivider, { backgroundColor: colors.borderLight }]} />
          <MetricCard
            icon="videocam"
            value={stats.consultations}
            label="Consultas"
            color={colors.primary}
            bg={colors.primarySoft}
            labelColor={colors.textMuted}
            delay={240}
          />
        </View>
      </View>

      {/* ── ATALHOS RÁPIDOS ── */}
      <View style={styles.quickActionsRow}>
        <QuickAction
          icon="document-text-outline"
          label="Pedidos"
          onPress={() => router.push('/(doctor)/requests')}
          colors={colors}
        />
        <QuickAction
          icon="notifications-outline"
          label="Alertas"
          onPress={() => router.push('/(doctor)/notifications')}
          colors={colors}
        />
        <QuickAction
          icon="shield-checkmark-outline"
          label="Certificado"
          onPress={() => router.push('/certificate/upload')}
          colors={colors}
        />
      </View>

      {/* ── ALERTA CERTIFICADO ── */}
      {hasCertificate === false && (
        <FadeIn visible {...motionTokens.fade.doctorSection} delay={80} fill={false}>
          <View style={{ paddingHorizontal: SCREEN_PAD }}>
            <CertificateAlert
              colors={colors}
              onPress={() => { haptics.selection(); router.push('/certificate/upload'); }}
            />
          </View>
        </FadeIn>
      )}

      {/* ── SECTION HEADER: FILA ── */}
      <View style={{ paddingHorizontal: SCREEN_PAD }}>
        <SectionHeader
          title="Fila de Atendimento"
          count={stats.pendentes > 0 ? stats.pendentes : undefined}
          actionText="Ver todos"
          onAction={() => { haptics.light(); router.push('/(doctor)/requests'); }}
        />
      </View>
    </>
  ), [
    headerGradient, insets, colors, greetingName, displayFirst, dateStr,
    isConnected, stats, hasCertificate, shadows, borderRadius, router,
  ]);

  // ─── Empty State ───────────────────────────────────────────
  const ListEmpty = useMemo(() => (
    <View style={{ paddingHorizontal: SCREEN_PAD }}>
      <AppEmptyState
        icon="checkmark-done-circle"
        title="Fila limpa!"
        subtitle="Nenhum paciente aguardando no momento."
      />
    </View>
  ), []);

  // ─── Loading State (após todos os hooks) ────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style="light" />
        <LinearGradient
          colors={headerGradient}
          style={[styles.headerSkeleton, { paddingTop: insets.top + 20 }]}
        />
        <View style={{ padding: SCREEN_PAD }}>
          <SkeletonList count={5} />
        </View>
      </View>
    );
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <ErrorBoundary>
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <FlatList
        data={pendingList}
        renderItem={renderQueueItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={{
          paddingBottom: 100 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.headerOverlayText}
            progressViewOffset={insets.top}
          />
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        windowSize={5}
        contentInsetAdjustmentBehavior="never"
      />
    </View>
    </ErrorBoundary>
  );
}

// ─── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  headerSkeleton: {
    height: 180,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  header: {
    paddingHorizontal: SCREEN_PAD,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  doctorName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  date: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  avatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginLeft: 12,
    flexShrink: 0,
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '800',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,  // unified with design system card radius
    borderWidth: 1,
    gap: 7,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Metrics
  metricsSection: {
    paddingHorizontal: SCREEN_PAD,
    marginTop: -1,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginTop: 16,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  metricDivider: {
    width: 1,
    height: 44,
    marginHorizontal: 3,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: SCREEN_PAD,
    gap: 10,
    marginBottom: 20,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  // Certificate Alert
  certAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    gap: 12,
  },
  certIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  certText: { flex: 1, minWidth: 0 },
  certTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  certDesc: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
