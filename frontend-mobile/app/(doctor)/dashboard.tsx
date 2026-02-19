import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, borderRadius, shadows, gradients, typography } from '../../lib/themeDoctor';
import { getRequests, getActiveCertificate } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { StatsCard } from '../../components/StatsCard';
import RequestCard from '../../components/RequestCard';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/ui/SkeletonLoader';

const MIN_TOUCH = 44;
const BP_SMALL = 376;
const HEADER_TOP_EXTRA = 12;

export default function DoctorDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { user, doctorProfile: doctor } = useAuth();
  const [queue, setQueue] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCertificate, setHasCertificate] = useState<boolean | null>(null);

  const isSmall = screenWidth < BP_SMALL;
  const statsGap = spacing.sm;
  const horizontalPad = Math.max(spacing.md, screenWidth * 0.04);
  const compact = screenWidth < 400;
  const headerPaddingTop = insets.top + HEADER_TOP_EXTRA;
  const headerPaddingBottom = compact ? 20 : spacing.lg;

  const loadData = useCallback(async () => {
    try {
      try {
        const cert = await getActiveCertificate();
        setHasCertificate(!!cert);
      } catch {
        setHasCertificate(false);
      }

      try {
        const res = await getRequests({ page: 1, pageSize: 100 });
        setQueue(res?.items ?? []);
      } catch {
        setQueue([]);
      }
    } catch (e) {
      console.error(e);
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
      const interval = setInterval(loadData, 25000);
      return () => clearInterval(interval);
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const stats = {
    queue: queue.filter(r => r.status === 'submitted').length,
    inReview: queue.filter(r => r.status === 'in_review').length,
    signed: queue.filter(r => ['signed', 'delivered'].includes(r.status)).length,
    consultations: queue.filter(r => r.requestType === 'consultation').length,
  };

  const queuePreview = queue.slice(0, 5);

  const statsConfig = [
    {
      icon: 'time' as const,
      iconColor: '#F59E0B',
      label: 'Aguardando',
      value: stats.queue,
      onPress: () => router.push({ pathname: '/(doctor)/requests', params: { status: 'submitted' } }),
    },
    {
      icon: 'search' as const,
      iconColor: '#3B82F6',
      label: 'Analisando',
      value: stats.inReview,
      onPress: () => router.push({ pathname: '/(doctor)/requests', params: { status: 'in_review' } }),
    },
    {
      icon: 'checkmark-circle' as const,
      iconColor: colors.primary,
      label: 'Assinados',
      value: stats.signed,
      onPress: () => router.push({ pathname: '/(doctor)/requests', params: { filter: 'signed_delivered' } }),
    },
    {
      icon: 'videocam' as const,
      iconColor: '#0096D6',
      label: 'Consultas',
      value: stats.consultations,
      onPress: () => router.push({ pathname: '/(doctor)/requests', params: { type: 'consultation' } }),
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header – Ocean Blue Gradient */}
      <LinearGradient
        colors={gradients.doctorHeader as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingHorizontal: horizontalPad, paddingTop: headerPaddingTop, paddingBottom: headerPaddingBottom }]}
      >
        <View style={styles.headerContent}>
          <View style={[styles.headerText, { flex: 1, marginRight: spacing.md }]}>
            <Text style={[styles.greeting, { fontSize: Math.min(24, Math.max(18, screenWidth * 0.06)) }]}>
              Dr. {user?.name?.split(' ')[0] || 'Médico'} 👋
            </Text>
            <Text style={[styles.subtitle, { fontSize: Math.max(13, Math.min(15, screenWidth * 0.038)) }]}>
              Seu painel de trabalho
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.avatar,
              {
                minWidth: MIN_TOUCH,
                minHeight: MIN_TOUCH,
                width: Math.max(MIN_TOUCH, screenWidth * 0.12),
                height: Math.max(MIN_TOUCH, screenWidth * 0.12),
                borderRadius: borderRadius.full,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => router.push('/(doctor)/profile')}
            hitSlop={8}
          >
            <Ionicons name="medkit" size={isSmall ? 24 : 28} color={colors.primary} />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Main content */}
      <View style={[styles.mainContent, { paddingHorizontal: horizontalPad, paddingTop: spacing.lg }]}>
        {/* Certificate alert */}
        {hasCertificate === false && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => router.push('/certificate/upload')}
            activeOpacity={0.8}
          >
            <View style={styles.alertIconWrap}>
              <Ionicons name="warning-outline" size={18} color="#B45309" />
            </View>
            <View style={styles.alertText}>
              <Text style={styles.alertTitle}>Certificado digital</Text>
              <Text style={styles.alertDesc}>Faça o upload para assinar documentos</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Stats summary */}
        <Text style={styles.sectionLabel}>Resumo</Text>
        {loading ? (
          <View style={{ marginBottom: spacing.lg }}>
            <SkeletonList count={2} />
          </View>
        ) : (
          <View style={[styles.statsRow, { gap: statsGap, marginBottom: spacing.lg }]}>
            {statsConfig.map(s => (
              <View key={s.label} style={{ flexBasis: isSmall ? '47%' : '23%', flexGrow: isSmall ? 0 : 1, flexShrink: 0, minWidth: 0, minHeight: 110 }}>
                <StatsCard icon={s.icon} iconColor={s.iconColor} label={s.label} value={s.value} onPress={s.onPress} />
              </View>
            ))}
          </View>
        )}

        {/* Recent requests */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontSize: Math.max(16, Math.min(18, screenWidth * 0.045)) }]}>
            Pedidos recentes
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(doctor)/requests')}
            style={styles.seeAllButton}
            activeOpacity={0.7}
          >
            <Text style={styles.seeAll}>Ver todos</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <SkeletonList count={3} />
        ) : queuePreview.length > 0 ? (
          <View style={styles.queueList}>
            {queuePreview.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                showPatientName
                onPress={() => router.push(`/doctor-request/${req.id}`)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="document-text-outline"
            title="Nenhum pedido no momento"
            subtitle="Novos pedidos aparecerão aqui. Toque em Ver todos para acessar a fila completa."
            actionLabel="Ir para solicitações"
            onAction={() => router.push('/(doctor)/requests')}
          />
        )}
      </View>
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
  header: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  avatar: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.card,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  alertIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,158,11,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertText: { flex: 1 },
  alertTitle: { fontSize: 14, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text },
  alertDesc: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },
  mainContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.text,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAll: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary,
    fontWeight: '600',
  },
  queueList: {
    gap: 0,
  },
});
