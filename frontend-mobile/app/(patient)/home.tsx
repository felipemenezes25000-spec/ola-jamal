import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { colors, gradients } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';
import { getRequests } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { getRequestUiState, needsPayment, isSignedOrDelivered } from '../../lib/domain/getRequestUiState';
import RequestCard from '../../components/RequestCard';
import { StatsCard } from '../../components/StatsCard';
import { LargeActionCard } from '../../components/ui/LargeActionCard';
import { InfoCard } from '../../components/ui/InfoCard';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/ui/SkeletonLoader';

export default function PatientHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { user } = useAuth();

  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await getRequests({ page: 1, pageSize: 50 });
      setRequests(response.items || []);
    } catch (error: unknown) {
      const status = (error as { status?: number })?.status;
      if (status === 401) {
        // Sessão expirada/inválida: AuthContext já chama clearAuth e o layout redireciona para login.
        setRequests([]);
        if (__DEV__) console.warn('[Home] 401: sessão encerrada, redirecionando para login.');
      } else {
        console.error('Error loading data:', error);
        setRequests([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const stats = useMemo(() => ({
    pending: requests.filter(r => getRequestUiState(r).uiState === 'needs_action').length,
    toPay: requests.filter(r => needsPayment(r)).length,
    ready: requests.filter(r => isSignedOrDelivered(r)).length,
  }), [requests]);

  const recentRequests = useMemo(() => requests.slice(0, 2), [requests]);
  const firstName = user?.name?.split(' ')[0] || 'Paciente';
  const initial = firstName[0]?.toUpperCase() || 'P';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <SkeletonList count={4} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: listPadding }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header: só saudação + avatar (igual ao web) */}
      <LinearGradient
        colors={[...gradients.patientHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerGreeting}>
            <Text style={styles.headerGreetingLabel}>Olá,</Text>
            <Text style={styles.headerGreetingName} numberOfLines={1} ellipsizeMode="tail">{firstName}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/(patient)/profile')}
          >
            <Text style={styles.avatarInitial}>{initial}</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Stats: três cards brancos flutuando sobre o fundo cinza */}
      <View style={styles.statsRow}>
        <StatsCard
          icon="analytics"
          label="Em análise"
          value={stats.pending}
          iconColor={colors.warning}
          iconBgColor="#FEF3C7"
          onPress={() => router.push('/(patient)/requests')}
        />
        <StatsCard
          icon="wallet"
          label="A pagar"
          value={stats.toPay}
          iconColor={colors.error}
          iconBgColor="#FEE2E2"
          onPress={() => router.push('/(patient)/requests')}
        />
        <StatsCard
          icon="shield-checkmark"
          label="Prontos"
          value={stats.ready}
          iconColor={colors.success}
          iconBgColor="#D1FAE5"
          onPress={() => router.push('/(patient)/requests')}
        />
      </View>

      {/* ─── Destaque: Triagem com IA ─── */}
      <View style={styles.aiBannerWrap}>
        <InfoCard
          icon="sparkles-outline"
          title="Triagem feita com IA"
          description="Leitura inteligente de receitas e exames para agilizar seu atendimento."
          badge="Tecnologia RenoveJá+"
        />
      </View>

      {/* ─── Quick Actions (largura total, menos margem) ─── */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>O que deseja fazer?</Text>
        <Text style={styles.sectionHint} numberOfLines={2} ellipsizeMode="tail">Toque em uma opção abaixo para começar: renovar receita, pedir exame ou falar com um profissional.</Text>
        <View style={styles.actionsColumn}>
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="document-text" size={24} color={colors.primary} />
              </View>
            }
            title="Renovar Receita"
            description="Solicitar renovação de receita médica"
            variant="primary"
            onPress={() => router.push('/new-request/prescription')}
          />
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: colors.infoLight }]}>
                <Ionicons name="flask" size={24} color={colors.info} />
              </View>
            }
            title="Pedir Exame"
            description="Solicitar exames e laudos"
            variant="exam"
            onPress={() => router.push('/new-request/exam')}
          />
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="videocam" size={24} color={colors.primary} />
              </View>
            }
            title="Consulta Breve +"
            description="Atendimento por vídeo com o médico"
            variant="consultation"
            onPress={() => router.push('/new-request/consultation')}
          />
        </View>
      </View>

      {/* ─── Recent Requests ─── */}
      {recentRequests.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pedidos recentes</Text>
            <Pressable
              onPress={() => router.push('/(patient)/requests')}
              style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.seeAllText}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.sectionHint} numberOfLines={2} ellipsizeMode="tail">Toque em um pedido para ver os detalhes. Use "Ver todos" para ver a lista completa.</Text>
          {recentRequests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              onPress={() => router.push(`/request-detail/${req.id}`)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.section}>
          <EmptyState
            icon="document-text-outline"
            emoji="📋"
            title="Nenhum pedido ainda"
            subtitle="Crie sua primeira solicitação usando as opções acima"
          />
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
  content: {},
  loadingContainer: {
    flex: 1,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingTop: 80,
    backgroundColor: colors.background,
  },

  // ─── Header ───
  header: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingBottom: 50,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: {
    flex: 1,
  },
  headerGreetingLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 2,
  },
  headerGreetingName: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  avatarBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#fff',
  },

  // ─── Destaque IA ───
  aiBannerWrap: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    marginTop: 24,
  },

  // ─── Stats (flutuando sobre o cinza, igual ao web) ───
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -44,
    marginBottom: 0,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    zIndex: 10,
    position: 'relative',
  },

  // ─── Sections ───
  section: {
    marginTop: 24,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 20,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // ─── Actions Section ───
  actionsSection: {
    marginTop: 24,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },
  actionsColumn: {
    flexDirection: 'column',
    gap: 16,
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
