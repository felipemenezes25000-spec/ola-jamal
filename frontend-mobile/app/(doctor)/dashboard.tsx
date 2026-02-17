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
import { getRequests, getActiveCertificate } from '../../lib/api';
import { RequestResponseDto, UserDto, DoctorProfileDto } from '../../types/database';
import { StatsCard } from '../../components/StatsCard';
import RequestCard from '../../components/RequestCard';

const MIN_TOUCH = 44;
const BP_SMALL = 376;
const HEADER_TOP_EXTRA = 12;

export default function DoctorDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [user, setUser] = useState<UserDto | null>(null);
  const [doctor, setDoctor] = useState<DoctorProfileDto | null>(null);
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
      const userData = await AsyncStorage.getItem('@renoveja:user');
      const doctorData = await AsyncStorage.getItem('@renoveja:doctor');
      if (userData) setUser(JSON.parse(userData));
      if (doctorData) setDoctor(JSON.parse(doctorData));

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

  // Recarrega ao voltar para a tela e polling para novas solicitações (sem depender de notificação)
  useFocusEffect(
    useCallback(() => {
      loadData();
      const interval = setInterval(loadData, 25000); // a cada 25s
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  const statsConfig = [
    {
      icon: 'list' as const,
      iconColor: '#F59E0B',
      label: 'Fila',
      value: stats.queue,
      onPress: () => router.push({ pathname: '/(doctor)/requests', params: { status: 'submitted' } }),
    },
    {
      icon: 'search' as const,
      iconColor: '#3B82F6',
      label: 'Em análise',
      value: stats.inReview,
      onPress: () => router.push({ pathname: '/(doctor)/requests', params: { status: 'in_review' } }),
    },
    {
      icon: 'checkmark-circle' as const,
      iconColor: '#10B981',
      label: 'Assinados',
      value: stats.signed,
      onPress: () => router.push({ pathname: '/(doctor)/requests', params: { filter: 'signed_delivered' } }),
    },
    {
      icon: 'videocam' as const,
      iconColor: '#0EA5E9',
      label: 'Consultas',
      value: stats.consultations,
      onPress: () => router.push({ pathname: '/(doctor)/requests', params: { type: 'consultation' } }),
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.secondary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient
        colors={['#10B981', '#34D399', '#6EE7B7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingHorizontal: horizontalPad, paddingTop: headerPaddingTop, paddingBottom: headerPaddingBottom }]}
      >
        <View style={styles.headerContent}>
          <View style={[styles.headerText, { flex: 1, marginRight: spacing.md }]}>
            <Text style={[styles.greeting, { fontSize: Math.min(24, Math.max(18, screenWidth * 0.06)) }]}>
              Dr. {user?.name?.split(' ')[0] || 'Médico'} 👋
            </Text>
            <Text style={[styles.subtitle, { fontSize: Math.max(12, Math.min(14, screenWidth * 0.035)) }]}>
              Painel do médico
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
                borderRadius: Math.max(22, screenWidth * 0.06),
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => router.push('/(doctor)/profile')}
            hitSlop={8}
          >
            <Ionicons name="medkit" size={isSmall ? 24 : 28} color={colors.secondary} />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Conteúdo principal - área organizada */}
      <View style={[styles.mainContent, { paddingHorizontal: horizontalPad, paddingTop: spacing.lg }]}>
        {/* Aviso de certificado */}
        {hasCertificate === false && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => router.push('/certificate/upload')}
            activeOpacity={0.8}
          >
            <Ionicons name="warning" size={22} color="#B45309" />
            <View style={styles.alertText}>
              <Text style={styles.alertTitle}>Certificado digital não encontrado</Text>
              <Text style={styles.alertDesc}>Faça o upload para poder assinar documentos</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Resumo - cards clicáveis */}
        <Text style={styles.sectionLabel}>Resumo</Text>
        <View style={[styles.statsRow, { gap: statsGap, marginBottom: spacing.lg }]}>
          {statsConfig.map(s => (
            <View key={s.label} style={{ flexBasis: isSmall ? '47%' : '23%', flexGrow: isSmall ? 0 : 1, flexShrink: 0, minWidth: 0 }}>
              <StatsCard icon={s.icon} iconColor={s.iconColor} label={s.label} value={s.value} onPress={s.onPress} />
            </View>
          ))}
        </View>

        {/* Fila de Atendimento */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontSize: Math.max(16, Math.min(18, screenWidth * 0.045)) }]}>
            Fila de Atendimento
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(doctor)/requests')}
            style={styles.seeAllButton}
            activeOpacity={0.7}
          >
            <Text style={styles.seeAll}>Ver todas</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {queuePreview.length > 0 ? (
          <View style={styles.queueList}>
            {queuePreview.map((req, idx) => (
              <RequestCard
                key={req.id}
                request={req}
                showPatientName
                onPress={() => router.push(`/doctor-request/${req.id}`)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="document-text-outline" size={48} color={colors.border} />
            </View>
            <Text style={styles.emptyTitle}>Nenhum pedido na fila</Text>
            <Text style={styles.emptySubtitle}>
              Pedidos enviados pelos pacientes aparecem aqui para análise e aprovação.
            </Text>
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={() => router.push('/(doctor)/requests')}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyCtaText}>Ir para solicitações</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
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
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
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
    backgroundColor: '#ECFDF5',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  alertText: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  alertDesc: { fontSize: 12, color: colors.textSecondary },
  mainContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sectionLabel: {
    fontSize: 12,
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
    color: colors.primary,
    fontWeight: '600',
  },
  queueList: {
    gap: 0,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 1.5,
    gap: spacing.md,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
